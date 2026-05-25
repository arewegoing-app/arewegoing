'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { events, promoOutreach } from '../db/schema';
import { checkEventOwner } from '../auth/owner';

const setStatusInput = z.object({
  eventId: z.string().min(1),
  status: z.enum(['not_asked', 'asked', 'got_code', 'declined']),
  code: z.string().max(64).optional(),
  notes: z.string().max(500).optional(),
});

export async function setPromoStatus(raw: z.input<typeof setStatusInput>) {
  const parsed = setStatusInput.parse(raw);
  const [event] = await db.select().from(events).where(eq(events.id, parsed.eventId)).limit(1);
  if (!event) throw new Error('no_event');
  const ownerCheck = await checkEventOwner(event);
  if (!ownerCheck.isOwner) throw new Error('not_owner');

  const now = new Date();
  await db
    .insert(promoOutreach)
    .values({
      eventId: event.id,
      status: parsed.status,
      code: parsed.code ?? null,
      notes: parsed.notes ?? null,
      askedAt: parsed.status === 'asked' ? now : null,
      resolvedAt: parsed.status === 'got_code' || parsed.status === 'declined' ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: promoOutreach.eventId,
      set: {
        status: parsed.status,
        code: parsed.code ?? null,
        notes: parsed.notes ?? null,
        ...(parsed.status === 'asked' ? { askedAt: now } : {}),
        ...(parsed.status === 'got_code' || parsed.status === 'declined' ? { resolvedAt: now } : {}),
        updatedAt: now,
      },
    });

  return { ok: true };
}
