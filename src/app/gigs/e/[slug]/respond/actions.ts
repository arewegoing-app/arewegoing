'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/app/gigs/lib/db/client';
import { eventInvites, rsvps } from '@/app/gigs/lib/db/schema';
import { evaluateEventConditions } from '@/app/gigs/lib/rsvp/conditions';

const input = z.object({
  eventInviteId: z.string().min(1),
  status: z.enum(['going', 'maybe', 'out']),
});

export async function setRsvpByInviteId(raw: z.input<typeof input>) {
  const parsed = input.parse(raw);
  const [invite] = await db.select().from(eventInvites).where(eq(eventInvites.id, parsed.eventInviteId)).limit(1);
  if (!invite) throw new Error('no_invite');
  await db
    .insert(rsvps)
    .values({ eventInviteId: parsed.eventInviteId, status: parsed.status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: rsvps.eventInviteId,
      set: { status: parsed.status, updatedAt: new Date() },
    });
  await evaluateEventConditions(invite.eventId);
  return { ok: true };
}
