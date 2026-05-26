'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { eventInvites, events } from '../db/schema';
import { checkEventOwner } from '../auth/owner';
import { requestBail } from './resale';

const input = z.object({ inviteId: z.string().min(1) });

export async function buyerMarksDrop(raw: z.input<typeof input>) {
  const parsed = input.parse(raw);
  const [invite] = await db.select().from(eventInvites).where(eq(eventInvites.id, parsed.inviteId)).limit(1);
  if (!invite) throw new Error('no_invite');
  const [event] = await db.select().from(events).where(eq(events.id, invite.eventId)).limit(1);
  if (!event) throw new Error('no_event');
  const ownerCheck = await checkEventOwner(event);
  if (!ownerCheck.isOwner) throw new Error('not_owner');
  const result = await requestBail({ inviteId: invite.id });
  if (!result.ok) throw new Error(result.reason);
  return { ok: true, offered: result.offered };
}
