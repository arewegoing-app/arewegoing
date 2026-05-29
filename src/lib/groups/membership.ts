'use server';

import { asc, eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/lib/db/client';
import { groupEvents, events, groups } from '@/lib/db/schema';
import { currentActor } from '@/lib/anon/current-actor';
import { log } from '@/lib/log';

/** Idempotent add — does nothing if the event is already in the group. */
export async function addPublicEventToGroup(groupId: string, eventId: string): Promise<void> {
  await ensureMigrated();
  const actor = await currentActor();

  await db
    .insert(groupEvents)
    .values({
      groupId,
      eventId,
      addedByUserId: actor.kind === 'user' ? actor.id : null,
      addedByAnonId: actor.kind === 'anon' ? actor.id : null,
    })
    .onConflictDoNothing();

  log.info({ groupId, eventId, actorKind: actor.kind }, 'group.event.added');
}

/** Remove an event from a group. Returns how many rows were deleted (0 or 1). */
export async function removePublicEventFromGroup(
  groupId: string,
  eventId: string,
): Promise<{ ok: true; removed: number }> {
  await ensureMigrated();

  const result = await db
    .delete(groupEvents)
    .where(eq(groupEvents.groupId, groupId) && eq(groupEvents.eventId, eventId))
    .returning();

  log.info({ groupId, eventId, removed: result.length }, 'group.event.removed');
  return { ok: true, removed: result.length };
}

export type GroupEventWithEvent = {
  groupEventId: string;
  eventId: string;
  addedAt: Date;
  isPinned: boolean;
  event: typeof events.$inferSelect;
};

/**
 * List events in a group, pinned event first then the rest in insertion order.
 */
export async function listGroupEvents(groupId: string): Promise<GroupEventWithEvent[]> {
  await ensureMigrated();

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  const pinnedEventId = group?.pinnedEventId ?? null;

  const rows = await db
    .select({
      groupEventId: groupEvents.id,
      eventId: groupEvents.eventId,
      addedAt: groupEvents.addedAt,
      event: events,
    })
    .from(groupEvents)
    .innerJoin(events, eq(events.id, groupEvents.eventId))
    .where(eq(groupEvents.groupId, groupId))
    .orderBy(asc(groupEvents.addedAt));

  const result: GroupEventWithEvent[] = rows.map((r) => ({
    groupEventId: r.groupEventId,
    eventId: r.eventId,
    addedAt: r.addedAt,
    isPinned: r.eventId === pinnedEventId,
    event: r.event,
  }));

  // Pinned event first.
  result.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.addedAt.getTime() - b.addedAt.getTime();
  });

  return result;
}
