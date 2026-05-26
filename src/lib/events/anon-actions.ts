'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../db/client';
import { events } from '../db/schema';
import { auth } from '../auth/auth';
import { getOrSetAnonId } from '../anon/identity';

const makeSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const createAnonInput = z.object({
  title: z.string().min(1).max(200),
  venue: z.string().max(200).optional(),
  city: z.string().max(100).default('Wellington'),
  startsAt: z.string().optional(),
  ticketUrl: z.string().url().optional().or(z.literal('')),
  priceLow: z.coerce.number().int().nonnegative().optional(),
  ownerName: z.string().min(1).max(100),
  ownerEmail: z.email(),
});

export async function createAnonEvent(formData: FormData) {
  const session = await auth();
  const anonId = await getOrSetAnonId();
  const raw = Object.fromEntries(formData.entries());
  const parsed = createAnonInput.parse({ ...raw, ticketUrl: raw.ticketUrl || undefined });
  const slug = makeSlug();
  const [event] = await db
    .insert(events)
    .values({
      slug,
      ownerUserId: session?.user?.id ?? null,
      anonOwnerId: session?.user?.id ? null : anonId,
      anonOwnerName: session?.user?.id ? null : parsed.ownerName,
      anonOwnerEmail: session?.user?.id ? null : parsed.ownerEmail,
      title: parsed.title,
      venue: parsed.venue ?? null,
      city: parsed.city,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      ticketUrl: parsed.ticketUrl || null,
      priceLow: parsed.priceLow ?? null,
    })
    .returning();
  redirect(`/gigs/e/${event.slug}`);
}

const claimInput = z.object({
  eventId: z.string().min(1),
  ownerName: z.string().min(1).max(100),
  ownerEmail: z.email(),
});

export type ClaimResult = { ok: true; slug: string } | { ok: false; reason: string };

export async function claimDiscoveredEvent(formData: FormData): Promise<ClaimResult> {
  const session = await auth();
  const anonId = await getOrSetAnonId();
  const parsed = claimInput.parse(Object.fromEntries(formData.entries()));

  const [event] = await db.select().from(events).where(eq(events.id, parsed.eventId)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };
  if (event.ownerUserId || event.anonOwnerId) {
    return { ok: false, reason: 'already_claimed' };
  }

  await db
    .update(events)
    .set({
      ownerUserId: session?.user?.id ?? null,
      anonOwnerId: session?.user?.id ? null : anonId,
      anonOwnerName: session?.user?.id ? null : parsed.ownerName,
      anonOwnerEmail: session?.user?.id ? null : parsed.ownerEmail,
    })
    .where(eq(events.id, event.id));

  return { ok: true, slug: event.slug };
}

void and; void isNull; void or;
