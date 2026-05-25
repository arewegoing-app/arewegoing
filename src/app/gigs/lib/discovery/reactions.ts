'use server';

import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { auth } from '../auth/auth';
import { eventReactions, events } from '../db/schema';
import { verifyToken } from '../tokens/token-service';
import { getOrSetAnonId } from '../anon/identity';

const reactionKindSchema = z.enum(['interested', 'down', 'cant', 'pledge_1', 'pledge_2']);
export type ReactionKind = z.infer<typeof reactionKindSchema>;

const setBuyerInput = z.object({
  eventId: z.string().min(1),
  kind: reactionKindSchema,
});

export async function setBuyerReaction(input: z.input<typeof setBuyerInput>) {
  const session = await auth();
  const parsed = setBuyerInput.parse(input);

  // Signed-in users react as themselves. Everyone else reacts anonymously via a
  // cookie UUID — no signin needed for the MVP.
  if (session?.user?.id) {
    await db
      .insert(eventReactions)
      .values({ eventId: parsed.eventId, userId: session.user.id, kind: parsed.kind })
      .onConflictDoUpdate({
        target: [eventReactions.eventId, eventReactions.recipientId, eventReactions.userId, eventReactions.anonId],
        set: { kind: parsed.kind, setAt: new Date() },
      });
    return { ok: true };
  }

  const anonId = await getOrSetAnonId();
  await db
    .insert(eventReactions)
    .values({ eventId: parsed.eventId, anonId, kind: parsed.kind })
    .onConflictDoUpdate({
      target: [eventReactions.eventId, eventReactions.recipientId, eventReactions.userId, eventReactions.anonId],
      set: { kind: parsed.kind, setAt: new Date() },
    });
  return { ok: true };
}

export type ReactionTokenResult =
  | { ok: true; kind: ReactionKind; eventSlug: string }
  | { ok: false; reason: string };

const TOKEN_ACTIONS: Record<string, ReactionKind> = {
  'react.interested': 'interested',
  'react.down': 'down',
  'react.cant': 'cant',
  'react.pledge_1': 'pledge_1',
  'react.pledge_2': 'pledge_2',
};

export async function applyReactionToken(token: string): Promise<ReactionTokenResult> {
  const verified = verifyToken(token);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  const kind = TOKEN_ACTIONS[verified.payload.act];
  if (!kind) return { ok: false, reason: 'unsupported_action' };

  const [event] = await db.select().from(events).where(eq(events.id, verified.payload.eid)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };

  await db
    .insert(eventReactions)
    .values({ eventId: event.id, recipientId: verified.payload.rid, kind })
    .onConflictDoUpdate({
      target: [eventReactions.eventId, eventReactions.recipientId, eventReactions.userId],
      set: { kind, setAt: new Date() },
    });

  return { ok: true, kind, eventSlug: event.slug };
}

export type ReactionTally = Record<ReactionKind, number>;

export async function getReactionTallies(eventIds: string[]): Promise<Map<string, ReactionTally>> {
  if (eventIds.length === 0) return new Map();
  const rows = await db
    .select({
      eventId: eventReactions.eventId,
      kind: eventReactions.kind,
      count: sql<number>`count(*)::int`,
    })
    .from(eventReactions)
    .where(sql`event_id = any(${eventIds})`)
    .groupBy(eventReactions.eventId, eventReactions.kind);

  const map = new Map<string, ReactionTally>();
  for (const e of eventIds) map.set(e, { interested: 0, down: 0, cant: 0, pledge_1: 0, pledge_2: 0 });
  for (const r of rows) {
    const tally = map.get(r.eventId);
    if (tally) tally[r.kind as ReactionKind] = Number(r.count);
  }
  return map;
}

void isNull; void and;
