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
import { log } from '../log';

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
  if (!row) {
    log.warn({ inviteId: parsed.inviteId, reason: 'no_invite' }, 'bail.rejected');
    return { ok: false, reason: 'no_invite' };
  }

  // Idempotency: if an open listing already exists, reuse it.
  const [existing] = await db
    .select()
    .from(resaleListings)
    .where(and(eq(resaleListings.originalInviteId, row.invite.id), eq(resaleListings.state, 'open'))!)
    .limit(1);

  if (!existing && row.rsvp.pledgeState !== 'locked') {
    log.warn(
      { inviteId: parsed.inviteId, eid: row.event.id, reason: 'not_locked' },
      'bail.rejected',
    );
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
    const claimLink = `${APP_URL}/r?t=${signToken({
      rid: c.recipient.id,
      eid: row.event.id,
      act: 'bail.claim',
      lid: listing.id,
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

  log.info(
    {
      inviteId: parsed.inviteId,
      eid: row.event.id,
      listingId: listing.id,
      offered,
      alreadyOpen: !!existing,
    },
    'bail.requested',
  );
  return { ok: true, listingId: listing.id, offered, alreadyOpen: !!existing };
}

export type BailTokenResult =
  | { ok: true; eventSlug: string; alreadyOpen: boolean }
  | { ok: false; reason: string };

export async function applyBailRequestToken(token: string): Promise<BailTokenResult> {
  const verified = verifyToken(token);
  if (!verified.ok) {
    log.warn({ reason: verified.reason }, 'bail.token.rejected');
    return { ok: false, reason: verified.reason };
  }
  const { rid, eid, act } = verified.payload;
  if (act !== 'bail.request') {
    log.warn({ rid, eid, act, reason: 'unsupported_action' }, 'bail.token.rejected');
    return { ok: false, reason: 'unsupported_action' };
  }

  const [event] = await db.select().from(events).where(eq(events.id, eid)).limit(1);
  if (!event) {
    log.warn({ rid, eid, reason: 'no_event' }, 'bail.token.rejected');
    return { ok: false, reason: 'no_event' };
  }

  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, rid), eq(eventInvites.eventId, event.id))!)
    .limit(1);
  if (!invite) {
    log.warn({ rid, eid, reason: 'no_invite' }, 'bail.token.rejected');
    return { ok: false, reason: 'no_invite' };
  }

  const result = await requestBail({ inviteId: invite.id });
  if (!result.ok) {
    log.warn({ rid, eid, inviteId: invite.id, reason: result.reason }, 'bail.token.rejected');
    return { ok: false, reason: result.reason };
  }
  log.info(
    { rid, eid, inviteId: invite.id, listingId: result.listingId, alreadyOpen: result.alreadyOpen },
    'bail.token.applied',
  );
  return { ok: true, eventSlug: event.slug, alreadyOpen: result.alreadyOpen };
}

export type ClaimResaleResult =
  | { ok: true; eventSlug: string; alreadyClaimed: boolean }
  | { ok: false; reason: string };

export async function applyResaleClaimToken(token: string): Promise<ClaimResaleResult> {
  const verified = verifyToken(token);
  if (!verified.ok) {
    log.warn({ reason: verified.reason }, 'claim.rejected');
    return { ok: false, reason: verified.reason };
  }
  const { rid, eid, act, lid } = verified.payload;
  if (act !== 'bail.claim') {
    log.warn({ rid, eid, act, reason: 'unsupported_action' }, 'claim.rejected');
    return { ok: false, reason: 'unsupported_action' };
  }

  const [event] = await db.select().from(events).where(eq(events.id, eid)).limit(1);
  if (!event) {
    log.warn({ rid, eid, reason: 'no_event' }, 'claim.rejected');
    return { ok: false, reason: 'no_event' };
  }

  const [claimerInvite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, rid), eq(eventInvites.eventId, event.id))!)
    .limit(1);
  if (!claimerInvite) {
    log.warn({ rid, eid, reason: 'no_invite' }, 'claim.rejected');
    return { ok: false, reason: 'no_invite' };
  }

  // Tokens issued after the lid migration carry the listing id; fall back to
  // the legacy "first open" lookup for older links still in flight.
  const listingId = lid;
  const [listing] = listingId
    ? await db
        .select()
        .from(resaleListings)
        .where(and(eq(resaleListings.id, listingId), eq(resaleListings.eventId, event.id))!)
        .limit(1)
    : await db
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
    if (taken) {
      log.info(
        { rid, eid, inviteId: claimerInvite.id, listingId: taken.id, alreadyClaimed: true },
        'claim.applied',
      );
      return { ok: true, eventSlug: event.slug, alreadyClaimed: true };
    }
    log.warn({ rid, eid, lid, reason: 'no_open_listing' }, 'claim.rejected');
    return { ok: false, reason: 'no_open_listing' };
  }
  if (listing.state !== 'open') {
    if (listing.claimedByInviteId === claimerInvite.id) {
      log.info(
        { rid, eid, inviteId: claimerInvite.id, listingId: listing.id, alreadyClaimed: true },
        'claim.applied',
      );
      return { ok: true, eventSlug: event.slug, alreadyClaimed: true };
    }
    log.warn(
      { rid, eid, listingId: listing.id, reason: 'listing_unavailable' },
      'claim.rejected',
    );
    return { ok: false, reason: 'listing_unavailable' };
  }
  if (listing.expiresAt.getTime() < Date.now()) {
    log.warn({ rid, eid, listingId: listing.id, reason: 'expired' }, 'claim.rejected');
    return { ok: false, reason: 'expired' };
  }

  // Mark listing claimed + repoint owed row + lock the claimer.
  // Race-guard: only the first concurrent claimer flips state='open' → 'claimed'.
  const claimedRows = await db
    .update(resaleListings)
    .set({ state: 'claimed', claimedByInviteId: claimerInvite.id, claimedAt: new Date() })
    .where(and(eq(resaleListings.id, listing.id), eq(resaleListings.state, 'open'))!)
    .returning({ id: resaleListings.id });
  if (claimedRows.length === 0) {
    log.warn(
      { rid, eid, listingId: listing.id, reason: 'listing_unavailable' },
      'claim.rejected',
    );
    return { ok: false, reason: 'listing_unavailable' };
  }
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

  // Slice 7b: resale claim filled the slot → release the original bailer's hold.
  const { releaseDeposit } = await import('../payments/actions');
  void releaseDeposit(listing.originalInviteId);

  log.info(
    {
      rid,
      eid,
      inviteId: claimerInvite.id,
      listingId: listing.id,
      originalInviteId: listing.originalInviteId,
    },
    'claim.applied',
  );
  return { ok: true, eventSlug: event.slug, alreadyClaimed: false };
}

export async function expireStaleListings(now: Date = new Date()): Promise<{ expired: number }> {
  const expired = await db
    .update(resaleListings)
    .set({ state: 'expired' })
    .where(and(eq(resaleListings.state, 'open'), lt(resaleListings.expiresAt, now))!)
    .returning({ id: resaleListings.id, originalInviteId: resaleListings.originalInviteId });

  // Slice 7b: unclaimed expired listings → capture the original bailer's hold.
  if (expired.length > 0) {
    const { captureBail } = await import('../payments/actions');
    for (const listing of expired) {
      void captureBail(listing.originalInviteId);
    }
  }

  if (expired.length > 0) {
    log.info({ expired: expired.length }, 'listings.expired');
  }
  return { expired: expired.length };
}

void users;
