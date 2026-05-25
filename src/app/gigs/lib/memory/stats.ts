// Reads across all events owned by the buyer to build reliability stats
// per recipient. No new tables — derived entirely from existing schema.

import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/client';
import {
  eventInvites,
  events,
  owed,
  pledgeCommitments,
  purchases,
  recipients,
  rsvps,
} from '../db/schema';

export interface ReliabilityStats {
  pledgedConfirmed: number;
  pledgedDropped: number;
  locked: number;
  paid: number;
  unpaid: number;
  bails: number;
  avgDaysToPay: number | null;
}

type BuyerFilter =
  | { buyerUserId: string }
  | { anonOwnerId: string };

/**
 * Returns a Map from recipientId → ReliabilityStats covering ALL events
 * the buyer has ever owned. Only recipients in `recipientIds` are included.
 *
 * @param filter  - either { buyerUserId } for authenticated buyers or
 *                  { anonOwnerId } for cookie-based owners
 * @param recipientIds - the subset of recipients to compute stats for
 */
export async function getReliabilityStats(
  filter: BuyerFilter,
  recipientIds: string[],
): Promise<Map<string, ReliabilityStats>> {
  const result = new Map<string, ReliabilityStats>();
  if (recipientIds.length === 0) return result;

  // All events owned by this buyer.
  const ownerFilter = 'buyerUserId' in filter
    ? eq(events.ownerUserId, filter.buyerUserId)
    : eq(events.anonOwnerId, filter.anonOwnerId);
  const buyerEvents = await db.select({ id: events.id }).from(events).where(ownerFilter);
  if (buyerEvents.length === 0) return result;
  const eventIds = buyerEvents.map((e) => e.id);

  // All invites for those events, limited to the requested recipients.
  const inviteRows = await db
    .select({ id: eventInvites.id, recipientId: eventInvites.recipientId, eventId: eventInvites.eventId })
    .from(eventInvites)
    .where(
      and(
        inArray(eventInvites.eventId, eventIds),
        inArray(eventInvites.recipientId, recipientIds),
      ),
    );
  if (inviteRows.length === 0) return result;

  const inviteIds = inviteRows.map((i) => i.id);
  // Map inviteId → recipientId for downstream aggregation.
  const inviteToRecipient = new Map(inviteRows.map((i) => [i.id, i.recipientId]));

  // Load rsvps for bail detection (pledgeState = 'bailed').
  const rsvpRows = await db
    .select({ eventInviteId: rsvps.eventInviteId, pledgeState: rsvps.pledgeState })
    .from(rsvps)
    .where(inArray(rsvps.eventInviteId, inviteIds));
  const rsvpByInvite = new Map(rsvpRows.map((r) => [r.eventInviteId, r.pledgeState]));

  // Load pledge commitments for confirmed/dropped/locked counts.
  const commitRows = await db
    .select({ eventInviteId: pledgeCommitments.eventInviteId, state: pledgeCommitments.state })
    .from(pledgeCommitments)
    .where(inArray(pledgeCommitments.eventInviteId, inviteIds));

  // Load owed rows for paid/unpaid. Join purchases to get createdAt for avgDaysToPay.
  const owedRows = await db
    .select({
      eventInviteId: owed.eventInviteId,
      paid: owed.paid,
      paidAt: owed.paidAt,
      purchaseCreatedAt: purchases.createdAt,
    })
    .from(owed)
    .innerJoin(purchases, eq(purchases.id, owed.purchaseId))
    .where(inArray(owed.eventInviteId, inviteIds));

  // Initialise a blank stats record for each requested recipient.
  const blank = (): ReliabilityStats => ({
    pledgedConfirmed: 0,
    pledgedDropped: 0,
    locked: 0,
    paid: 0,
    unpaid: 0,
    bails: 0,
    avgDaysToPay: null,
  });
  // Accumulate days-to-pay separately so we can compute the mean at the end.
  const daysToPay = new Map<string, number[]>();

  for (const recipientId of recipientIds) {
    result.set(recipientId, blank());
    daysToPay.set(recipientId, []);
  }

  // Aggregate rsvp bails.
  for (const [inviteId, pledgeState] of rsvpByInvite) {
    const recipientId = inviteToRecipient.get(inviteId);
    if (!recipientId) continue;
    const s = result.get(recipientId);
    if (!s) continue;
    if (pledgeState === 'bailed') s.bails += 1;
  }

  // Aggregate pledge commitment states.
  for (const row of commitRows) {
    const recipientId = inviteToRecipient.get(row.eventInviteId);
    if (!recipientId) continue;
    const s = result.get(recipientId);
    if (!s) continue;
    if (row.state === 'confirmed') {
      s.pledgedConfirmed += 1;
    } else if (row.state === 'dropped') {
      s.pledgedDropped += 1;
      // Also count as a bail per the spec.
      s.bails += 1;
    }
  }

  // Aggregate owed rows.
  for (const row of owedRows) {
    const recipientId = inviteToRecipient.get(row.eventInviteId);
    if (!recipientId) continue;
    const s = result.get(recipientId);
    if (!s) continue;
    if (row.paid === 1) {
      s.paid += 1;
      if (row.paidAt && row.purchaseCreatedAt) {
        const days =
          (new Date(row.paidAt).getTime() - new Date(row.purchaseCreatedAt).getTime()) /
          86_400_000;
        daysToPay.get(recipientId)!.push(days);
      }
    } else {
      s.unpaid += 1;
    }
  }

  // Also count locked rsvps.
  for (const [inviteId, pledgeState] of rsvpByInvite) {
    const recipientId = inviteToRecipient.get(inviteId);
    if (!recipientId) continue;
    const s = result.get(recipientId);
    if (!s) continue;
    if (pledgeState === 'locked') s.locked += 1;
  }

  // Compute avgDaysToPay.
  for (const [recipientId, days] of daysToPay) {
    if (days.length === 0) continue;
    const avg = days.reduce((sum, d) => sum + d, 0) / days.length;
    result.get(recipientId)!.avgDaysToPay = avg;
  }

  return result;
}
