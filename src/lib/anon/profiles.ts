'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { anonProfiles } from '@/lib/db/schema';
import { getOrSetAnonId } from './identity';

export type { AnonProfile } from '@/lib/db/schema';

const profileInputSchema = z.object({
  emoji: z.string().trim().min(1).max(8).optional(),
  displayName: z.string().trim().min(1).max(32).optional(),
});
export type ProfileInput = z.input<typeof profileInputSchema>;

/**
 * Server action: read the current anon cookie server-side and upsert the
 * profile against it. Client components call this without passing an id —
 * fixes the previous "__cookie__" placeholder bug.
 */
export async function setMyAnonProfile(input: ProfileInput) {
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: 'invalid_input' as const };
  const anonId = await getOrSetAnonId();
  const row = await setAnonProfile(anonId, parsed.data);
  return { ok: true as const, profile: row };
}

/** Look up an existing anon profile row. Returns null if none exists. */
export async function getAnonProfile(anonId: string) {
  const rows = await db
    .select()
    .from(anonProfiles)
    .where(eq(anonProfiles.id, anonId))
    .limit(1);
  return rows[0] ?? null;
}

/** Upsert an anon profile. Creates on first call, updates on subsequent calls. */
export async function setAnonProfile(
  anonId: string,
  input: { emoji?: string; displayName?: string },
) {
  const [row] = await db
    .insert(anonProfiles)
    .values({
      id: anonId,
      emoji: input.emoji ?? null,
      displayName: input.displayName ?? null,
    })
    .onConflictDoUpdate({
      target: anonProfiles.id,
      set: {
        emoji: input.emoji ?? null,
        displayName: input.displayName ?? null,
      },
    })
    .returning();
  return row;
}
