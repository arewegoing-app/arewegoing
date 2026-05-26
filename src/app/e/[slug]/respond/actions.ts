'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { eventInvites, rsvps } from '@/lib/db/schema';
import { evaluateEventConditions } from '@/lib/rsvp/conditions';

const ownTicketInput = z.object({
  eventInviteId: z.string().min(1),
  hasOwnTicket: z.boolean(),
});

export async function setHasOwnTicket(raw: z.input<typeof ownTicketInput>) {
  const parsed = ownTicketInput.parse(raw);
  await db
    .update(eventInvites)
    .set({ hasOwnTicket: parsed.hasOwnTicket ? 1 : 0 })
    .where(eq(eventInvites.id, parsed.eventInviteId));
  return { ok: true };
}

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
