'use server';

import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/lib/db/client';
import { events, groups, groupEvents } from '@/lib/db/schema';
import { currentActor } from '@/lib/anon/current-actor';
import { log } from '@/lib/log';

export type ShareEventResult =
  | { ok: true; groupId: string; url: string }
  | { ok: false; reason: 'event_not_found' };

/**
 * Share an event as a new group calendar URL.
 * Each call creates a NEW group — no deduplication, because callers may want
 * fresh shareable URLs (e.g. for different audiences).
 */
export async function shareEventAsGroup(eventId: string): Promise<ShareEventResult> {
  await ensureMigrated();

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return { ok: false, reason: 'event_not_found' };

  const actor = await currentActor();
  const slug = nanoid(12);

  const [group] = await db
    .insert(groups)
    .values({
      slug,
      name: `Shared: ${event.title}`,
      city: event.city ?? 'Wellington',
      creatorUserId: actor.kind === 'user' ? actor.id : null,
      creatorAnonId: actor.kind === 'anon' ? actor.id : null,
      ownerUserId: actor.kind === 'user' ? actor.id : null,
      anonOwnerId: actor.kind === 'anon' ? actor.id : null,
      pinnedEventId: event.id,
    })
    .returning();

  await db.insert(groupEvents).values({
    groupId: group.id,
    eventId: event.id,
    addedByUserId: actor.kind === 'user' ? actor.id : null,
    addedByAnonId: actor.kind === 'anon' ? actor.id : null,
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${base}/group/${group.id}/calendar`;

  log.info({ groupId: group.id, eventId, actorKind: actor.kind }, 'group.share.created');

  return { ok: true, groupId: group.id, url };
}
