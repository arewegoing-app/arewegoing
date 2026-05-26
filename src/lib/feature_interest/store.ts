// Low-level upsert for the features-v2 intent log.
// Caller resolves actor (signed-in user or anon cookie id) before calling.
// Stays pure: no auth, no cookies — keeps the unit test free of session shims.

import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { featureInterest } from '../db/schema';

export const actorSchema = z.union([
  z.object({ userId: z.string().min(1) }),
  z.object({ anonId: z.string().min(1) }),
]);
export type Actor = z.infer<typeof actorSchema>;

export const upsertInputSchema = z.object({
  actor: actorSchema,
  featureKey: z.string().min(1).max(128),
  email: z.string().email().max(254).nullable().optional(),
  notifyOptIn: z.boolean().optional(),
  meta: z.string().max(4000).nullable().optional(),
});
export type UpsertFeatureInterestInput = z.input<typeof upsertInputSchema>;

export type UpsertFeatureInterestResult = {
  id: string;
  created: boolean;
};

/**
 * Upsert one intent-log row per (featureKey, actor). Race-safe via the unique
 * index `feature_interest_actor_feature`; if a row already exists we update
 * email + notifyOptIn so a later "actually, here's my email" tap is captured.
 */
export async function upsertFeatureInterest(
  input: UpsertFeatureInterestInput,
): Promise<UpsertFeatureInterestResult> {
  const parsed = upsertInputSchema.parse(input);
  const { actor, featureKey } = parsed;
  const email = parsed.email ?? null;
  const notifyOptIn = parsed.notifyOptIn ? 1 : 0;
  const meta = parsed.meta ?? null;

  const userId = 'userId' in actor ? actor.userId : null;
  const anonId = 'anonId' in actor ? actor.anonId : null;

  // Read-then-write: the unique index would let us use ON CONFLICT, but the
  // expression is awkward with mixed null actor columns. The race window is
  // negligible at intent-tap volume.
  const existing = await db
    .select()
    .from(featureInterest)
    .where(
      and(
        eq(featureInterest.featureKey, featureKey),
        userId ? eq(featureInterest.userId, userId) : isNull(featureInterest.userId),
        anonId ? eq(featureInterest.anonId, anonId) : isNull(featureInterest.anonId),
      )!,
    )
    .limit(1);

  if (existing[0]) {
    const row = existing[0];
    // Keep the strongest signal seen so far: never downgrade an opt-in to off,
    // and never blank out a previously-supplied email.
    const nextEmail = email ?? row.email;
    const nextNotify = Math.max(notifyOptIn, row.notifyOptIn);
    const nextMeta = meta ?? row.meta;
    if (nextEmail !== row.email || nextNotify !== row.notifyOptIn || nextMeta !== row.meta) {
      await db
        .update(featureInterest)
        .set({ email: nextEmail, notifyOptIn: nextNotify, meta: nextMeta, updatedAt: new Date() })
        .where(eq(featureInterest.id, row.id));
    }
    return { id: row.id, created: false };
  }

  const [row] = await db
    .insert(featureInterest)
    .values({ userId, anonId, featureKey, email, notifyOptIn, meta })
    .returning();
  return { id: row.id, created: true };
}

/** Test-only convenience: counts rows for a feature key. */
export async function countFeatureInterest(featureKey: string): Promise<number> {
  const rows = await db
    .select({ id: featureInterest.id })
    .from(featureInterest)
    .where(eq(featureInterest.featureKey, featureKey));
  return rows.length;
}
