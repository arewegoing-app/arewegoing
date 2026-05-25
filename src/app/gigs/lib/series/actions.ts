'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { seriesSubscriptions, users } from '../db/schema';
import { auth } from '../auth/auth';
import { getOrSetAnonId } from '../anon/identity';

const subInput = z.object({
  seriesName: z.string().min(1).max(200),
  email: z.string().email().optional(),
});

export async function subscribeToSeries(raw: z.input<typeof subInput>) {
  const parsed = subInput.parse(raw);
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = userId ? null : await getOrSetAnonId();
  const email = parsed.email
    ?? (userId ? (await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1))[0]?.email ?? null : null);

  await db
    .insert(seriesSubscriptions)
    .values({ seriesName: parsed.seriesName, userId, anonId, email: email ?? null })
    .onConflictDoNothing();

  return { ok: true };
}

export async function unsubscribeFromSeries(raw: z.input<typeof subInput>) {
  const parsed = subInput.parse(raw);
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = userId ? null : await getOrSetAnonId();

  if (userId) {
    await db
      .delete(seriesSubscriptions)
      .where(and(eq(seriesSubscriptions.seriesName, parsed.seriesName), eq(seriesSubscriptions.userId, userId))!);
  } else if (anonId) {
    await db
      .delete(seriesSubscriptions)
      .where(and(eq(seriesSubscriptions.seriesName, parsed.seriesName), eq(seriesSubscriptions.anonId, anonId))!);
  }
  return { ok: true };
}

export async function isSubscribed(seriesName: string): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (userId) {
    const [row] = await db
      .select({ id: seriesSubscriptions.id })
      .from(seriesSubscriptions)
      .where(and(eq(seriesSubscriptions.seriesName, seriesName), eq(seriesSubscriptions.userId, userId))!)
      .limit(1);
    return !!row;
  }
  // For anon, read cookie without setting (avoid side effects in RSC reads).
  const { readAnonId } = await import('../anon/identity');
  const anonId = await readAnonId();
  if (!anonId) return false;
  const [row] = await db
    .select({ id: seriesSubscriptions.id })
    .from(seriesSubscriptions)
    .where(and(eq(seriesSubscriptions.seriesName, seriesName), eq(seriesSubscriptions.anonId, anonId))!)
    .limit(1);
  return !!row;
}
