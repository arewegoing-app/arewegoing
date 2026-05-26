import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { eventInvites, rsvps, emailTokens } from '../db/schema';
import { verifyToken } from '../tokens/token-service';
import { evaluateEventConditions } from './conditions';
import { log } from '../log';

export type RsvpResult =
  | { ok: true; status: 'going' | 'maybe' | 'out'; alreadyConsumed: boolean }
  | { ok: false; reason: string };

const actionToStatus: Record<string, 'going' | 'maybe' | 'out'> = {
  'rsvp.in': 'going',
  'rsvp.maybe': 'maybe',
  'rsvp.out': 'out',
};

export async function applyTokenRsvp(token: string): Promise<RsvpResult> {
  const verified = verifyToken(token);
  if (!verified.ok) {
    log.warn({ reason: verified.reason }, 'rsvp.rejected');
    return { ok: false, reason: verified.reason };
  }
  const { rid, eid, act } = verified.payload;
  const status = actionToStatus[act];
  if (!status) {
    log.warn({ rid, eid, act, reason: 'unsupported_action' }, 'rsvp.rejected');
    return { ok: false, reason: 'unsupported_action' };
  }

  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, rid), eq(eventInvites.eventId, eid)))
    .limit(1);
  if (!invite) {
    log.warn({ rid, eid, act, reason: 'no_invite' }, 'rsvp.rejected');
    return { ok: false, reason: 'no_invite' };
  }

  // Atomic idempotency guard — race-condition-safe alternative to a SELECT then INSERT pair.
  //
  // We INSERT the token row first (with consumedAt set). The unique index on
  // (recipient_id, event_id, action) means only one concurrent request wins;
  // the other gets an empty `returning` array via ON CONFLICT DO NOTHING.
  //
  // This collapses the old read-then-write window without db.transaction()
  // (which the Neon HTTP driver does not support).
  const inserted = await db
    .insert(emailTokens)
    .values({
      recipientId: rid,
      eventId: eid,
      action: act,
      expiresAt: new Date(verified.payload.exp * 1000),
      consumedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    // Another request already consumed this token — return the existing RSVP outcome.
    const [r] = await db.select().from(rsvps).where(eq(rsvps.eventInviteId, invite.id)).limit(1);
    const existingStatus = (r?.status ?? status) as 'going' | 'maybe' | 'out';
    log.info({ rid, eid, act, inviteId: invite.id }, 'rsvp.already_consumed');
    return { ok: true, status: existingStatus, alreadyConsumed: true };
  }

  // First request through — write the RSVP and evaluate conditions exactly once.
  await db
    .insert(rsvps)
    .values({ eventInviteId: invite.id, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: rsvps.eventInviteId,
      set: { status, updatedAt: new Date() },
    });

  await db.update(eventInvites).set({ lastClickedAt: new Date() }).where(eq(eventInvites.id, invite.id));

  // Any rsvp change can affect conditional invites elsewhere on this event.
  await evaluateEventConditions(invite.eventId);

  log.info({ rid, eid, act, inviteId: invite.id, status }, 'rsvp.applied');
  return { ok: true, status, alreadyConsumed: false };
}
