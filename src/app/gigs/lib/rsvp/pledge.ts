'use server';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import {
  events,
  eventInvites,
  finalCalls,
  pledgeCommitments,
  recipients,
  rsvps,
  users,
} from '../db/schema';
import { auth } from '../auth/auth';
import { signToken, verifyToken } from '../tokens/token-service';
import { sendEmail } from '../notifications/email';
import { finalCallEmail } from '../notifications/templates-pledge';

const APP_URL = process.env.GIGS_APP_URL ?? 'http://localhost:3000';
const FINAL_CALL_TTL_SEC = 60 * 60 * 24 * 7;

const startInput = z.object({
  eventId: z.string().min(1),
  pledgeAmount: z.coerce.number().int().positive(),
  deadlineHours: z.coerce.number().int().positive().max(168).default(6),
});

export async function startFinalCall(input: z.input<typeof startInput>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const parsed = startInput.parse(input);

  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, parsed.eventId), eq(events.ownerUserId, session.user.id)))
    .limit(1);
  if (!event) throw new Error('Event not found');

  const goingInvites = await db
    .select({ invite: eventInvites, recipient: recipients })
    .from(eventInvites)
    .innerJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
    .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .where(and(eq(eventInvites.eventId, event.id), eq(rsvps.status, 'going')));
  if (goingInvites.length === 0) throw new Error('No going recipients');

  const deadlineAt = new Date(Date.now() + parsed.deadlineHours * 60 * 60 * 1000);
  const [call] = await db
    .insert(finalCalls)
    .values({
      eventId: event.id,
      triggeredByUserId: session.user.id,
      deadlineAt,
      pledgeAmount: parsed.pledgeAmount,
    })
    .returning();

  await db.insert(pledgeCommitments).values(
    goingInvites.map((g) => ({ finalCallId: call.id, eventInviteId: g.invite.id })),
  );

  const [buyer] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  for (const { recipient, invite } of goingInvites) {
    const links = {
      confirm: `${APP_URL}/gigs/r?t=${signToken({ rid: recipient.id, eid: event.id, act: 'pledge.confirm', ttlSec: FINAL_CALL_TTL_SEC })}`,
      drop: `${APP_URL}/gigs/r?t=${signToken({ rid: recipient.id, eid: event.id, act: 'pledge.drop', ttlSec: FINAL_CALL_TTL_SEC })}`,
      view: `${APP_URL}/gigs/e/${event.slug}?t=${signToken({ rid: recipient.id, eid: event.id, act: 'view', ttlSec: FINAL_CALL_TTL_SEC })}`,
    };
    void invite; // for typing
    const tmpl = finalCallEmail({
      buyer: { name: buyer?.name ?? '', email: buyer?.email ?? '' },
      recipient,
      event,
      pledgeAmount: parsed.pledgeAmount,
      deadlineAt,
      links,
    });
    await sendEmail({ to: recipient.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
  }

  return { finalCallId: call.id, asked: goingInvites.length };
}

export type PledgeTokenResult =
  | { ok: true; action: 'confirmed' | 'dropped'; alreadyConsumed: boolean }
  | { ok: false; reason: string };

export async function applyPledgeToken(token: string): Promise<PledgeTokenResult> {
  const verified = verifyToken(token);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  const { act, rid, eid } = verified.payload;
  if (act !== 'pledge.confirm' && act !== 'pledge.drop') return { ok: false, reason: 'unsupported_action' };

  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, rid), eq(eventInvites.eventId, eid)))
    .limit(1);
  if (!invite) return { ok: false, reason: 'no_invite' };

  const [call] = await db
    .select()
    .from(finalCalls)
    .where(and(eq(finalCalls.eventId, eid), eq(finalCalls.status, 'pending')))
    .orderBy(sql`triggered_at desc`)
    .limit(1);
  if (!call) return { ok: false, reason: 'no_active_call' };

  const [commitment] = await db
    .select()
    .from(pledgeCommitments)
    .where(and(eq(pledgeCommitments.finalCallId, call.id), eq(pledgeCommitments.eventInviteId, invite.id)))
    .limit(1);
  if (!commitment) return { ok: false, reason: 'not_invited_to_call' };

  if (commitment.state !== 'asked') {
    return { ok: true, action: commitment.state === 'confirmed' ? 'confirmed' : 'dropped', alreadyConsumed: true };
  }

  if (act === 'pledge.confirm') {
    await db
      .update(pledgeCommitments)
      .set({ state: 'confirmed', respondedAt: new Date() })
      .where(eq(pledgeCommitments.id, commitment.id));
    await db
      .update(rsvps)
      .set({ pledgeState: 'pledged', pledgedAmount: call.pledgeAmount, pledgedAt: new Date(), updatedAt: new Date() })
      .where(eq(rsvps.eventInviteId, invite.id));
    return { ok: true, action: 'confirmed', alreadyConsumed: false };
  }

  await db
    .update(pledgeCommitments)
    .set({ state: 'dropped', respondedAt: new Date() })
    .where(eq(pledgeCommitments.id, commitment.id));
  await db
    .update(rsvps)
    .set({ status: 'maybe', updatedAt: new Date() })
    .where(eq(rsvps.eventInviteId, invite.id));
  return { ok: true, action: 'dropped', alreadyConsumed: false };
}

export async function closeFinalCall(finalCallId: string) {
  const [call] = await db.select().from(finalCalls).where(eq(finalCalls.id, finalCallId)).limit(1);
  if (!call || call.status === 'closed') return;

  const stillAsked = await db
    .select()
    .from(pledgeCommitments)
    .where(and(eq(pledgeCommitments.finalCallId, call.id), eq(pledgeCommitments.state, 'asked')));

  if (stillAsked.length > 0) {
    const inviteIds = stillAsked.map((c) => c.eventInviteId);
    await db
      .update(rsvps)
      .set({ status: 'maybe', updatedAt: new Date() })
      .where(inArray(rsvps.eventInviteId, inviteIds));
    await db
      .update(pledgeCommitments)
      .set({ state: 'dropped', respondedAt: new Date() })
      .where(inArray(pledgeCommitments.id, stillAsked.map((c) => c.id)));
  }

  await db
    .update(finalCalls)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(finalCalls.id, call.id));
}

export async function closeExpiredFinalCalls(now: Date = new Date()) {
  const expired = await db
    .select()
    .from(finalCalls)
    .where(and(eq(finalCalls.status, 'pending'), sql`deadline_at <= ${now}`));
  for (const c of expired) await closeFinalCall(c.id);
  return { closed: expired.length };
}
