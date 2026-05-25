'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  eventInvites,
  events,
  owed,
  recipients,
  resaleListings,
  rsvps,
} from '../db/schema';

const input = z.object({
  eventId: z.string().min(1),
  claimerName: z.string().min(1).max(100),
  claimerEmail: z.email(),
});

export type AnonClaimResult =
  | { ok: true; eventSlug: string; alreadyClaimed: boolean }
  | { ok: false; reason: string };

export async function anonClaimResale(raw: z.input<typeof input>): Promise<AnonClaimResult> {
  const parsed = input.parse(raw);

  const [event] = await db.select().from(events).where(eq(events.id, parsed.eventId)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };

  // Find an open listing for this event. First-come, first-served.
  const [listing] = await db
    .select()
    .from(resaleListings)
    .where(and(eq(resaleListings.eventId, event.id), eq(resaleListings.state, 'open'))!)
    .limit(1);
  if (!listing) return { ok: false, reason: 'no_open_listing' };
  if (listing.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  const normalisedEmail = parsed.claimerEmail.toLowerCase();
  const ownerScope = event.ownerUserId
    ? { ownerUserId: event.ownerUserId, anonOwnerId: null }
    : { ownerUserId: null, anonOwnerId: event.anonOwnerId };

  // Reuse existing recipient if the claimer's email is already in this owner's
  // address book, otherwise create one on the fly.
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
        displayName: parsed.claimerName,
      })
      .returning();
    recipient = created;
  }

  // Find or create the event_invite for this recipient + event.
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

  // Idempotency: if this person already claimed THIS listing, return success.
  if (listing.claimedByInviteId === invite.id) {
    return { ok: true, eventSlug: event.slug, alreadyClaimed: true };
  }

  // Race-condition guard: only one row can win the open → claimed transition.
  // We use a conditional update + check rowsAffected.
  const claimed = await db
    .update(resaleListings)
    .set({ state: 'claimed', claimedByInviteId: invite.id, claimedAt: new Date() })
    .where(and(eq(resaleListings.id, listing.id), eq(resaleListings.state, 'open'))!)
    .returning({ id: resaleListings.id });
  if (claimed.length === 0) return { ok: false, reason: 'already_taken' };

  await db
    .update(owed)
    .set({ eventInviteId: invite.id, paid: 0, paidAt: null, lastRemindedAt: null })
    .where(eq(owed.eventInviteId, listing.originalInviteId));

  await db
    .insert(rsvps)
    .values({ eventInviteId: invite.id, status: 'going', pledgeState: 'locked', lockedAt: new Date() })
    .onConflictDoUpdate({
      target: rsvps.eventInviteId,
      set: { status: 'going', pledgeState: 'locked', lockedAt: new Date(), updatedAt: new Date() },
    });

  await db
    .update(rsvps)
    .set({ pledgeState: 'replaced', updatedAt: new Date() })
    .where(eq(rsvps.eventInviteId, listing.originalInviteId));

  return { ok: true, eventSlug: event.slug, alreadyClaimed: false };
}
