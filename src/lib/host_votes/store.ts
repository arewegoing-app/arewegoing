// Low-level read/write for the features-v2 slice-7 host-vote system.
// Pure DB helpers — caller resolves actor so the unit test can stay free of
// session and cookie shims.

import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { hostVotes } from '../db/schema';

export const kindSchema = z.enum(['predrinks', 'afters']);
export type HostKind = z.infer<typeof kindSchema>;

export const actorSchema = z.union([
  z.object({ userId: z.string().min(1) }),
  z.object({ anonId: z.string().min(1) }),
]);
export type Actor = z.infer<typeof actorSchema>;

export const castVoteInputSchema = z.object({
  actor: actorSchema,
  eventId: z.string().min(1),
  kind: kindSchema,
  candidateLabel: z.string().min(1).max(120),
});
export type CastVoteInput = z.input<typeof castVoteInputSchema>;

/**
 * Upsert one vote per (event, kind, actor). Re-voting for a different label
 * switches your vote rather than spawning a new row.
 */
export async function castHostVote(input: CastVoteInput): Promise<{ id: string; switched: boolean }> {
  const parsed = castVoteInputSchema.parse(input);
  const userId = 'userId' in parsed.actor ? parsed.actor.userId : null;
  const anonId = 'anonId' in parsed.actor ? parsed.actor.anonId : null;

  const existing = await db
    .select()
    .from(hostVotes)
    .where(
      and(
        eq(hostVotes.eventId, parsed.eventId),
        eq(hostVotes.kind, parsed.kind),
        userId ? eq(hostVotes.voterUserId, userId) : isNull(hostVotes.voterUserId),
        anonId ? eq(hostVotes.voterAnonId, anonId) : isNull(hostVotes.voterAnonId),
      )!,
    )
    .limit(1);

  if (existing[0]) {
    const row = existing[0];
    if (row.candidateLabel === parsed.candidateLabel) return { id: row.id, switched: false };
    await db
      .update(hostVotes)
      .set({ candidateLabel: parsed.candidateLabel, votedAt: new Date() })
      .where(eq(hostVotes.id, row.id));
    return { id: row.id, switched: true };
  }

  const [row] = await db
    .insert(hostVotes)
    .values({
      eventId: parsed.eventId,
      kind: parsed.kind,
      candidateLabel: parsed.candidateLabel,
      voterUserId: userId,
      voterAnonId: anonId,
    })
    .returning();
  return { id: row.id, switched: false };
}

export type HostVoteTallyRow = {
  candidateLabel: string;
  count: number;
  mine: boolean;
};
export type HostVoteTally = {
  predrinks: HostVoteTallyRow[];
  afters: HostVoteTallyRow[];
};

/**
 * Aggregate votes for an event grouped by (kind, candidateLabel).
 * `mine: true` marks the row the supplied actor voted for, if any.
 */
export async function getHostVoteTally(
  eventId: string,
  actor: Actor | null,
): Promise<HostVoteTally> {
  const userId = actor && 'userId' in actor ? actor.userId : null;
  const anonId = actor && 'anonId' in actor ? actor.anonId : null;

  const rows = await db
    .select({
      kind: hostVotes.kind,
      candidateLabel: hostVotes.candidateLabel,
      count: sql<number>`count(*)::int`,
    })
    .from(hostVotes)
    .where(eq(hostVotes.eventId, eventId))
    .groupBy(hostVotes.kind, hostVotes.candidateLabel);

  let myVotes: { kind: 'predrinks' | 'afters'; candidateLabel: string }[] = [];
  if (userId || anonId) {
    myVotes = await db
      .select({ kind: hostVotes.kind, candidateLabel: hostVotes.candidateLabel })
      .from(hostVotes)
      .where(
        and(
          eq(hostVotes.eventId, eventId),
          userId ? eq(hostVotes.voterUserId, userId) : isNull(hostVotes.voterUserId),
          anonId ? eq(hostVotes.voterAnonId, anonId) : isNull(hostVotes.voterAnonId),
        )!,
      );
  }
  const mineSet = new Set(myVotes.map((m) => `${m.kind}::${m.candidateLabel}`));

  const out: HostVoteTally = { predrinks: [], afters: [] };
  for (const r of rows) {
    out[r.kind as 'predrinks' | 'afters'].push({
      candidateLabel: r.candidateLabel,
      count: Number(r.count),
      mine: mineSet.has(`${r.kind}::${r.candidateLabel}`),
    });
  }
  out.predrinks.sort((a, b) => b.count - a.count);
  out.afters.sort((a, b) => b.count - a.count);
  return out;
}
