'use server';

import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { events, eventInvites, recipients } from '../db/schema';
import { checkEventOwner } from '../auth/owner';
import { signToken } from '../tokens/token-service';

const makeToken = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);

const eventIdInput = z.object({ eventId: z.string().min(1) });

/**
 * Turn on "anyone with the link can RSVP" mode for an event. Returns the
 * shareable URL fragment (caller composes the full URL).
 */
export async function enablePublicInvite(raw: z.input<typeof eventIdInput>): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const { eventId } = eventIdInput.parse(raw);
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };
  const ownerCheck = await checkEventOwner(event);
  if (!ownerCheck.isOwner) return { ok: false, reason: 'not_owner' };

  let token = event.publicInviteToken;
  if (!token) {
    token = makeToken();
    await db.update(events).set({ publicInviteToken: token }).where(eq(events.id, event.id));
  }
  return { ok: true, token };
}

export async function disablePublicInvite(raw: z.input<typeof eventIdInput>) {
  const { eventId } = eventIdInput.parse(raw);
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new Error('no_event');
  const ownerCheck = await checkEventOwner(event);
  if (!ownerCheck.isOwner) throw new Error('not_owner');
  await db.update(events).set({ publicInviteToken: null }).where(eq(events.id, event.id));
  return { ok: true };
}

const joinInput = z.object({
  eventId: z.string().min(1),
  publicToken: z.string().min(1),
  joinerName: z.string().min(1).max(100),
  joinerEmail: z.string().email(),
});

const APP_URL = process.env.GIGS_APP_URL ?? 'http://localhost:3000';
const TTL_SEC = 60 * 60 * 24 * 30;

/**
 * Public join handler. Called from the /gigs/e/[slug]/join page after the
 * visitor enters name + email. Creates (or reuses) a recipient + invite scoped
 * to the event owner, then returns a personal respond-link the visitor can
 * bookmark.
 */
export async function joinViaPublicInvite(raw: z.input<typeof joinInput>): Promise<{ ok: true; respondUrl: string } | { ok: false; reason: string }> {
  const parsed = joinInput.parse(raw);
  const [event] = await db.select().from(events).where(eq(events.id, parsed.eventId)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };
  if (!event.publicInviteToken || event.publicInviteToken !== parsed.publicToken) {
    return { ok: false, reason: 'invalid_token' };
  }

  const normalisedEmail = parsed.joinerEmail.toLowerCase();
  const ownerScope = event.ownerUserId
    ? { ownerUserId: event.ownerUserId, anonOwnerId: null }
    : { ownerUserId: null, anonOwnerId: event.anonOwnerId };

  // Reuse the existing recipient row if this email is already in the owner's
  // address book — keeps the buyer from accumulating duplicates.
  const candidates = await db
    .select()
    .from(recipients)
    .where(eq(recipients.email, normalisedEmail));
  let recipient = candidates.find(
    (r) =>
      (ownerScope.ownerUserId && r.ownerUserId === ownerScope.ownerUserId) ||
      (ownerScope.anonOwnerId && r.anonOwnerId === ownerScope.anonOwnerId),
  );
  if (!recipient) {
    const [created] = await db
      .insert(recipients)
      .values({
        ownerUserId: ownerScope.ownerUserId,
        anonOwnerId: ownerScope.anonOwnerId,
        email: normalisedEmail,
        displayName: parsed.joinerName,
      })
      .returning();
    recipient = created;
  }

  let [invite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, recipient.id), eq(eventInvites.eventId, event.id))!)
    .limit(1);
  if (!invite) {
    const [created] = await db
      .insert(eventInvites)
      .values({ eventId: event.id, recipientId: recipient.id })
      .returning();
    invite = created;
  }

  const respondToken = signToken({ rid: recipient.id, eid: event.id, act: 'rsvp.respond', ttlSec: TTL_SEC });
  return { ok: true, respondUrl: `${APP_URL}/gigs/e/${event.slug}/respond?t=${respondToken}` };
}
