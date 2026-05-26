'use server';

import { z } from 'zod';
import { auth } from '../auth/auth';
import { getOrSetAnonId } from '../anon/identity';
import { upsertFeatureInterest, type Actor } from './store';

const inputSchema = z.object({
  featureKey: z.string().min(1).max(128),
  email: z.string().email().max(254).optional(),
  notifyOptIn: z.boolean().optional(),
  meta: z.string().max(4000).optional(),
});
export type RecordFeatureInterestInput = z.input<typeof inputSchema>;

export type RecordFeatureInterestResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: 'invalid_input' };

/**
 * Server action invoked from clickable feature shells.
 * Resolves the actor (signed-in user or anon cookie) and upserts the intent.
 */
export async function recordFeatureInterest(
  input: RecordFeatureInterestInput,
): Promise<RecordFeatureInterestResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };

  const session = await auth();
  const actor: Actor = session?.user?.id
    ? { userId: session.user.id }
    : { anonId: await getOrSetAnonId() };

  const result = await upsertFeatureInterest({
    actor,
    featureKey: parsed.data.featureKey,
    email: parsed.data.email ?? null,
    notifyOptIn: parsed.data.notifyOptIn ?? false,
    meta: parsed.data.meta ?? null,
  });
  return { ok: true, created: result.created };
}
