'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { auth } from '../auth/auth';
import { events } from '../db/schema';

const input = z.object({ eventId: z.string().min(1) });

export type PromoteResult = { ok: true; slug: string } | { ok: false; reason: string };

export async function promoteToRally(raw: z.input<typeof input>): Promise<PromoteResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: 'unauthorized' };
  const parsed = input.parse(raw);
  const [event] = await db.select().from(events).where(eq(events.id, parsed.eventId)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };
  if (event.ownerUserId && event.ownerUserId !== session.user.id) return { ok: false, reason: 'already_owned' };
  if (event.ownerUserId === session.user.id) return { ok: true, slug: event.slug };
  await db.update(events).set({ ownerUserId: session.user.id }).where(eq(events.id, event.id));
  return { ok: true, slug: event.slug };
}
