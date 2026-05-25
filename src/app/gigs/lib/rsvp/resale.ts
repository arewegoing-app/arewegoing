'use server';

import { z } from 'zod';
import { and, eq, lt, ne } from 'drizzle-orm';
import { db } from '../db/client';
import {
  eventInvites,
  events,
  owed,
  purchases,
  recipients,
  resaleListings,
  rsvps,
  users,
} from '../db/schema';
import { signToken, verifyToken } from '../tokens/token-service';
import { sendEmail } from '../notifications/email';
import { resaleOfferEmail } from '../notifications/templates-resale';

const APP_URL = process.env.GIGS_APP_URL ?? 'http://localhost:3000';
const CLAIM_TTL_SEC = 60 * 60 * 24 * 7; // 7 days to claim
const DEFAULT_EXPIRES_DAYS = 3;

export type BailRequestResult =
  | { ok: true; listingId: string; offered: number; alreadyOpen: boolean }
  | { ok: false; reason: string };

const requestInput = z.object({
  inviteId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function requestBail(raw: z.input<typeof requestInput>): Promise<BailRequestResult> {
  const parsed = requestInput.parse(raw);

  const [row] = await db
    .select({ invite: eventInvites, rsvp: rsvps, event: events, recipient: recipients })
    .from(eventInvites)
    .innerJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
    .innerJoin(events, eq(events.id, eventInvites.eventId))
    .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .where(eq(eventInvites.id, parsed.inviteId))
    .limit(1);
  if (!row) return { ok: false, reason: 'no_invite' };

  // Idempotency: if an open listing already exists, reuse it.
  const [existing] = await db
    .select()
    .from(resaleListings)
    .where(and(eq(resaleListings.originalInviteId, row.invite.id), eq(resaleListings.state, 'open'))!)
    .limit(1);

  if (!existing && row.rsvp.pledgeState !== 'locked') {
    return { ok: false, reason: 'not_locked' };
  }

  let listing = existing;
  if (!listing) {
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const [created] = await db
      .insert(resaleListings)
      .values({
        eventId: row.event.id,
        originalInviteId: row.invite.id,
        expiresAt,
        reason: parsed.reason ?? null,
      })
      .returning();
    listing = created;
    await db
      .update(rsvps)
      .set({ pledgeState: 'bailed', bailedAt: new Date(), updatedAt: new Date() })
      .where(eq(rsvps.eventInviteId, row.invite.id));
  }

  // Find the owed amount for this invite so we can quote it.
  const [owedRow] = await db
    .select({ owed: owed })
    .from(owed)
    .innerJoin(purchases, eq(purchases.id, owed.purchaseId))
    .where(and(eq(owed.eventInviteId, row.invite.id), eq(purchases.eventId, row.event.id))!)
    .limit(1);
  const amountCents = owedRow?.owed.amountCents ?? 0;

  // Fan-out to other recipients of the same event (not pledged/locked themselves).
  const candidates = await db
    .select({ invite: eventInvites, recipient: recipients, rsvp: rsvps })
    .from(eventInvites)
    .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .leftJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
    .where(and(eq(eventInvites.eventId, row.event.id), ne(eventInvites.id, row.invite.id))!);

  const offerees = candidates.filter(
    (c) => c.rsvp?.pledgeState !== 'locked' && c.rsvp?.pledgeState !== 'pledged',
  );

  let offered = 0;
  for (const c of offerees) {
    const claimLink = `${APP_URL}/gigs/r?t=${signToken({
      rid: c.recipient.id,
      eid: row.event.id,
      act: 'bail.claim',
      ttlSec: CLAIM_TTL_SEC,
    })}`;
    const tmpl = resaleOfferEmail({
      recipient: c.recipient,
      event: row.event,
      bailerName: row.recipient.displayName,
      amountCents,
      expiresAt: listing.expiresAt,
      claimLink,
    });
    await sendEmail({ to: c.recipient.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
    offered++;
  }

  return { ok: true, listingId: listing.id, offered, alreadyOpen: !!existing };
}

export type BailTokenResult =
  | { ok: true; eventSlug: string; alreadyOpen: boolean }
  | { ok: false; reason: string };

export async function applyBailRequestToken(token: string): Promise<BailTokenResult> {
  const verified = verifyToken(token);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  if (verified.payload.act !== 'bail.request') return { ok: false, reason: 'unsupported_action' };

  const [event] = await db.select().from(events).where(eq(events.id, verified.payload.eid)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };

  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, verified.payload.rid), eq(eventInvites.eventId, event.id))!)
    .limit(1);
  if (!invite) return { ok: false, reason: 'no_invite' };

  const result = await requestBail({ inviteId: invite.id });
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, eventSlug: event.slug, alreadyOpen: result.alreadyOpen };
}

export type ClaimResaleResult =
  | { ok: true; eventSlug: string; alreadyClaimed: boolean }
  | { ok: false; reason: string };

export async function applyResaleClaimToken(token: string): Promise<ClaimResaleResult> {
  const verified = verifyToken(token);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  if (verified.payload.act !== 'bail.claim') return { ok: false, reason: 'unsupported_action' };

  const [event] = await db.select().from(events).where(eq(events.id, verified.payload.eid)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };

  const [claimerInvite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, verified.payload.rid), eq(eventInvites.eventId, event.id))!)
    .limit(1);
  if (!claimerInvite) return { ok: false, reason: 'no_invite' };

  const [listing] = await db
    .select()
    .from(resaleListings)
    .where(and(eq(resaleListings.eventId, event.id), eq(resaleListings.state, 'open'))!)
    .limit(1);
  if (!listing) {
    // Maybe already claimed by this same person.
    const [taken] = await db
      .select()
      .from(resaleListings)
      .where(and(eq(resaleListings.eventId, event.id), eq(resaleListings.claimedByInviteId, claimerInvite.id))!)
      .limit(1);
    if (taken) return { ok: true, eventSlug: event.slug, alreadyClaimed: true };
    return { ok: false, reason: 'no_open_listing' };
  }
  if (listing.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  // Mark listing claimed + repoint owed row + lock the claimer.
  await db
    .update(resaleListings)
    .set({ state: 'claimed', claimedByInviteId: claimerInvite.id, claimedAt: new Date() })
    .where(eq(resaleListings.id, listing.id));
  await db
    .update(owed)
    .set({ eventInviteId: claimerInvite.id, paid: 0, paidAt: null, lastRemindedAt: null })
    .where(eq(owed.eventInviteId, listing.originalInviteId));
  await db
    .insert(rsvps)
    .values({ eventInviteId: claimerInvite.id, status: 'going', pledgeState: 'locked', lockedAt: new Date() })
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

export async function expireStaleListings(now: Date = new Date()): Promise<{ expired: number }> {
  const expired = await db
    .update(resaleListings)
    .set({ state: 'expired' })
    .where(and(eq(resaleListings.state, 'open'), lt(resaleListings.expiresAt, now))!)
    .returning({ id: resaleListings.id });
  return { expired: expired.length };
}

void users;
