import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { eventInvites, rsvps, emailTokens } from '../db/schema';
import { verifyToken } from '../tokens/token-service';

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
  if (!verified.ok) return { ok: false, reason: verified.reason };
  const status = actionToStatus[verified.payload.act];
  if (!status) return { ok: false, reason: 'unsupported_action' };

  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, verified.payload.rid), eq(eventInvites.eventId, verified.payload.eid)))
    .limit(1);
  if (!invite) return { ok: false, reason: 'no_invite' };

  const [existingToken] = await db
    .select()
    .from(emailTokens)
    .where(and(eq(emailTokens.recipientId, verified.payload.rid), eq(emailTokens.eventId, verified.payload.eid)))
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
      recipientId: verified.payload.rid,
      eventId: verified.payload.eid,
      action: verified.payload.act,
      expiresAt: new Date(verified.payload.exp * 1000),
      consumedAt: new Date(),
    })
    .onConflictDoNothing();

  await db.update(eventInvites).set({ lastClickedAt: new Date() }).where(eq(eventInvites.id, invite.id));
  return { ok: true, status, alreadyConsumed: false };
}
