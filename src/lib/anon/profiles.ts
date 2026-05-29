'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { anonProfiles } from '@/lib/db/schema';

export type { AnonProfile } from '@/lib/db/schema';

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
