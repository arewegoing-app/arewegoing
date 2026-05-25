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

  // Scope the consumed-check to the specific action so a recipient who clicked
  // "Yes" yesterday can still change to "Maybe" via a later email link.
  const [existingToken] = await db
    .select()
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.recipientId, rid),
        eq(emailTokens.eventId, eid),
        eq(emailTokens.action, act),
      ),
    )
    .limit(1);
  const alreadyConsumed = !!existingToken?.consumedAt;

  if (alreadyConsumed) {
    const [r] = await db.select().from(rsvps).where(eq(rsvps.eventInviteId, invite.id)).limit(1);
    if (r) return { ok: true, status: r.status as 'going' | 'maybe' | 'out', alreadyConsumed: true };
  }

  await db
    .insert(rsvps)
    .values({ eventInviteId: invite.id, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: rsvps.eventInviteId,
      set: { status, updatedAt: new Date() },
    });

  await db
    .insert(emailTokens)
    .values({
      recipientId: rid,
      eventId: eid,
      action: act,
      expiresAt: new Date(verified.payload.exp * 1000),
      consumedAt: new Date(),
    })
    .onConflictDoNothing();

  await db.update(eventInvites).set({ lastClickedAt: new Date() }).where(eq(eventInvites.id, invite.id));

  // Any rsvp change can affect conditional invites elsewhere on this event.
  await evaluateEventConditions(invite.eventId);

  log.info({ rid, eid, act, inviteId: invite.id, status }, 'rsvp.applied');
  return { ok: true, status, alreadyConsumed: false };
}
