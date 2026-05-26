'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { artists, artistSubscriptions, users } from '../db/schema';
import { auth } from '../auth/auth';
import { getOrSetAnonId } from '../anon/identity';

const artistInput = z.object({
  artistName: z.string().min(1).max(200),
  songkickId: z.string().optional(),
  email: z.string().email().optional(),
});

/**
 * Normalise an artist name for deduplication (lower-case, collapse whitespace,
 * strip leading/trailing whitespace).
 */
function normalise(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Resolve or create an artist row by normalised name.
 * If songkickId is provided and the existing row has none, update it.
 */
async function resolveArtist(
  artistName: string,
  songkickId: string | undefined,
): Promise<string> {
  const normalizedName = normalise(artistName);

  const existing = await db
    .select({ id: artists.id, songkickId: artists.songkickId })
    .from(artists)
    .where(eq(artists.normalizedName, normalizedName))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (songkickId && !row.songkickId) {
      await db.update(artists).set({ songkickId }).where(eq(artists.id, row.id));
    }
    return row.id;
  }

  const [created] = await db
    .insert(artists)
    .values({ name: artistName, normalizedName, songkickId: songkickId ?? null })
    .returning({ id: artists.id });
  return created.id;
}

/**
 * Subscribe the current user (or anon) to artist notifications.
 * Silently ignores duplicate subscriptions (onConflictDoNothing).
 */
export async function subscribeToArtist(raw: z.input<typeof artistInput>) {
  const parsed = artistInput.parse(raw);
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = userId ? null : await getOrSetAnonId();

  const resolvedEmail =
    parsed.email ??
    (userId
      ? (await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1))[0]?.email ?? null
      : null);

  const artistId = await resolveArtist(parsed.artistName, parsed.songkickId);

  await db
    .insert(artistSubscriptions)
    .values({ artistId, userId, anonId, email: resolvedEmail ?? null })
    .onConflictDoNothing();

  return { ok: true };
}

/**
 * Remove the current user's (or anon's) subscription to the named artist.
 */
export async function unsubscribeFromArtist(raw: z.input<typeof artistInput>) {
  const parsed = artistInput.parse(raw);
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = userId ? null : await getOrSetAnonId();

  const normalizedName = normalise(parsed.artistName);
  const [artist] = await db
    .select({ id: artists.id })
    .from(artists)
    .where(eq(artists.normalizedName, normalizedName))
    .limit(1);
  if (!artist) return { ok: true };

  if (userId) {
    await db
      .delete(artistSubscriptions)
      .where(
        and(
          eq(artistSubscriptions.artistId, artist.id),
          eq(artistSubscriptions.userId, userId),
        )!,
      );
  } else if (anonId) {
    await db
      .delete(artistSubscriptions)
      .where(
        and(
          eq(artistSubscriptions.artistId, artist.id),
          eq(artistSubscriptions.anonId, anonId),
        )!,
      );
  }
  return { ok: true };
}

/**
 * Return true if the current session (user or anon) is subscribed to the
 * named artist. Does not set a cookie — safe to call from RSC read contexts.
 */
export async function isSubscribedToArtist(artistName: string): Promise<boolean> {
  const normalizedName = normalise(artistName);
  const [artist] = await db
    .select({ id: artists.id })
    .from(artists)
    .where(eq(artists.normalizedName, normalizedName))
    .limit(1);
  if (!artist) return false;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (userId) {
    const [row] = await db
      .select({ id: artistSubscriptions.id })
      .from(artistSubscriptions)
      .where(
        and(
          eq(artistSubscriptions.artistId, artist.id),
          eq(artistSubscriptions.userId, userId),
        )!,
      )
      .limit(1);
    return !!row;
  }

  const { readAnonId } = await import('../anon/identity');
  const anonId = await readAnonId();
  if (!anonId) return false;

  const [row] = await db
    .select({ id: artistSubscriptions.id })
    .from(artistSubscriptions)
    .where(
      and(
        eq(artistSubscriptions.artistId, artist.id),
        eq(artistSubscriptions.anonId, anonId),
      )!,
    )
    .limit(1);
  return !!row;
}
