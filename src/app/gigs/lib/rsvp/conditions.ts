'use server';

import { z } from 'zod';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db/client';
import {
  eventInvites,
  events,
  promoOutreach,
  rsvpConditions,
  rsvps,
} from '../db/schema';
import { log } from '../log';

const conditionInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('min_going'), value: z.coerce.number().int().positive() }),
  z.object({ kind: z.literal('price_ceiling'), value: z.coerce.number().int().nonnegative() }),
  z.object({ kind: z.literal('requires_promo'), value: z.boolean() }),
]);

const setInput = z.object({
  eventInviteId: z.string().min(1),
  conditions: z.array(conditionInput).max(3),
});

/**
 * Replace the set of conditions on an invite and flip the rsvp to 'conditional'.
 * Caller is responsible for triggering evaluate() afterwards.
 */
export async function setRsvpConditions(raw: z.input<typeof setInput>) {
  const parsed = setInput.parse(raw);

  await db.delete(rsvpConditions).where(eq(rsvpConditions.eventInviteId, parsed.eventInviteId));
  if (parsed.conditions.length > 0) {
    await db.insert(rsvpConditions).values(
      parsed.conditions.map((c) => ({
        eventInviteId: parsed.eventInviteId,
        kind: c.kind,
        intValue: c.kind === 'requires_promo' ? null : Number(c.value),
        boolValue: c.kind === 'requires_promo' ? (c.value ? 1 : 0) : null,
      })),
    );
    await db
      .insert(rsvps)
      .values({ eventInviteId: parsed.eventInviteId, status: 'conditional', updatedAt: new Date() })
      .onConflictDoUpdate({
        target: rsvps.eventInviteId,
        set: { status: 'conditional', updatedAt: new Date() },
      });
  }

  const [invite] = await db.select().from(eventInvites).where(eq(eventInvites.id, parsed.eventInviteId)).limit(1);
  if (invite) await evaluateEventConditions(invite.eventId);
  return { ok: true };
}

/**
 * Re-evaluate every conditional RSVP for an event:
 *   - all conditions satisfied   → flip 'conditional' → 'going'
 *   - any condition newly unmet  → flip 'going' (still conditional) → 'conditional'
 *
 * Idempotent. Safe to call after any state change in the event.
 */
export async function evaluateEventConditions(eventId: string): Promise<{ promoted: number; demoted: number }> {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { promoted: 0, demoted: 0 };

  const [promo] = await db.select().from(promoOutreach).where(eq(promoOutreach.eventId, eventId)).limit(1);
  const hasPromoCode = promo?.status === 'got_code';

  const allInvites = await db
    .select({ invite: eventInvites, rsvp: rsvps })
    .from(eventInvites)
    .leftJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
    .where(eq(eventInvites.eventId, eventId));

  const goingCount = allInvites.filter((r) => r.rsvp?.status === 'going').length;

  const inviteIdsWithConditions = allInvites
    .filter((r) => r.rsvp?.status === 'conditional' || r.rsvp?.status === 'going')
    .map((r) => r.invite.id);

  if (inviteIdsWithConditions.length === 0) return { promoted: 0, demoted: 0 };

  const conds = await db
    .select()
    .from(rsvpConditions)
    .where(inArray(rsvpConditions.eventInviteId, inviteIdsWithConditions));

  const byInvite = new Map<string, typeof conds>();
  for (const c of conds) {
    const list = byInvite.get(c.eventInviteId) ?? [];
    list.push(c);
    byInvite.set(c.eventInviteId, list);
  }

  let promoted = 0;
  let demoted = 0;
  for (const { invite, rsvp } of allInvites) {
    if (!rsvp) continue;
    const list = byInvite.get(invite.id) ?? [];
    if (list.length === 0) continue;

    // For min_going we exclude this invite itself from the count.
    const othersGoing = rsvp.status === 'going' ? goingCount - 1 : goingCount;

    const evaluation = list.map((c) => {
      if (c.kind === 'min_going') return othersGoing >= (c.intValue ?? 0);
      if (c.kind === 'price_ceiling') return (event.priceLow ?? Number.POSITIVE_INFINITY) <= (c.intValue ?? 0);
      if (c.kind === 'requires_promo') return c.boolValue ? hasPromoCode : true;
      return false;
    });
    const allSatisfied = evaluation.every(Boolean);

    // Persist per-condition satisfaction for the UI.
    for (let i = 0; i < list.length; i++) {
      const wantSatisfied = evaluation[i] ? 1 : 0;
      if (list[i].satisfied !== wantSatisfied) {
        await db.update(rsvpConditions).set({ satisfied: wantSatisfied }).where(eq(rsvpConditions.id, list[i].id));
      }
    }

    if (rsvp.status === 'conditional' && allSatisfied) {
      await db.update(rsvps).set({ status: 'going', updatedAt: new Date() }).where(eq(rsvps.eventInviteId, invite.id));
      promoted++;
    } else if (rsvp.status === 'going' && !allSatisfied) {
      await db.update(rsvps).set({ status: 'conditional', updatedAt: new Date() }).where(eq(rsvps.eventInviteId, invite.id));
      demoted++;
    }
  }

  // If anyone flipped, re-run once: a promotion may satisfy another invite's
  // min_going threshold (cascading effect). Cap at one extra pass to avoid loops.
  if ((promoted > 0 || demoted > 0)) {
    const inner = await db
      .select({ invite: eventInvites, rsvp: rsvps })
      .from(eventInvites)
      .innerJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
      .where(and(eq(eventInvites.eventId, eventId), eq(rsvps.status, 'conditional'))!);
    if (inner.length > 0) {
      const second = await evaluateEventConditions(eventId);
      promoted += second.promoted;
      demoted += second.demoted;
    }
  }

  if (promoted > 0 || demoted > 0) {
    log.info({ eid: eventId, promoted, demoted }, 'conditions.evaluated');
  }
  return { promoted, demoted };
}

void ne;
