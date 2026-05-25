'use server';

import { and, eq, sql } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import { db } from '../db/client';
import { groups, groupMembers, recipients } from '../db/schema';
import type { Group } from '../db/schema';
import { auth } from '../auth/auth';
import { getOrSetAnonId } from '../anon/identity';

const makeSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

/** Resolves the caller's identity. Returns { userId } or { anonId }. */
async function ownerIdentity(): Promise<{ userId: string | null; anonId: string | null }> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id, anonId: null };
  const anonId = await getOrSetAnonId();
  return { userId: null, anonId };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the default "My friends" group for the current identity, creating
 * it if it doesn't already exist. Used by addRecipient / createEvent to
 * ensure every buyer has a group before they explicitly manage one.
 */
export async function getOrCreateDefaultGroup(): Promise<Group> {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) throw new Error('no_identity');

  const ownerFilter = id.userId
    ? eq(groups.ownerUserId, id.userId)
    : eq(groups.anonOwnerId, id.anonId!);

  // Find existing default group (name = 'My friends').
  const [existing] = await db
    .select()
    .from(groups)
    .where(and(ownerFilter, eq(groups.name, 'My friends')))
    .limit(1);

  if (existing) return existing;

  const slug = makeSlug();
  const [created] = await db
    .insert(groups)
    .values({
      slug,
      name: 'My friends',
      ownerUserId: id.userId,
      anonOwnerId: id.anonId,
    })
    .returning();

  return created;
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

const createGroupInput = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
});

/** Creates a named group for the current buyer. */
export async function createGroup(input: { name: string; slug?: string }): Promise<Group> {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) throw new Error('no_identity');

  const parsed = createGroupInput.parse(input);
  const slug = parsed.slug ?? makeSlug();

  const [group] = await db
    .insert(groups)
    .values({
      slug,
      name: parsed.name,
      ownerUserId: id.userId,
      anonOwnerId: id.anonId,
    })
    .returning();

  return group;
}

/** Adds a recipient to a group owned by the current buyer. */
export async function addRecipientToGroup({
  groupId,
  recipientId,
}: {
  groupId: string;
  recipientId: string;
}): Promise<void> {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) throw new Error('no_identity');

  // Verify the group belongs to the caller.
  const ownerFilter = id.userId
    ? eq(groups.ownerUserId, id.userId)
    : eq(groups.anonOwnerId, id.anonId!);

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), ownerFilter))
    .limit(1);

  if (!group) throw new Error('group_not_found_or_not_owner');

  await db
    .insert(groupMembers)
    .values({ groupId, recipientId })
    .onConflictDoNothing();
}

/** Removes a recipient from a group owned by the current buyer. */
export async function removeFromGroup({
  groupId,
  recipientId,
}: {
  groupId: string;
  recipientId: string;
}): Promise<void> {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) throw new Error('no_identity');

  // Verify ownership before deleting.
  const ownerFilter = id.userId
    ? eq(groups.ownerUserId, id.userId)
    : eq(groups.anonOwnerId, id.anonId!);

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), ownerFilter))
    .limit(1);

  if (!group) throw new Error('group_not_found_or_not_owner');

  await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.recipientId, recipientId),
      ),
    );
}

export interface GroupWithCount extends Group {
  memberCount: number;
}

/**
 * Lists all groups owned by the current buyer, with member counts.
 */
export async function listMyGroups(): Promise<GroupWithCount[]> {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) return [];

  const ownerFilter = id.userId
    ? eq(groups.ownerUserId, id.userId)
    : eq(groups.anonOwnerId, id.anonId!);

  const rows = await db
    .select({
      id: groups.id,
      slug: groups.slug,
      name: groups.name,
      ownerUserId: groups.ownerUserId,
      anonOwnerId: groups.anonOwnerId,
      city: groups.city,
      createdAt: groups.createdAt,
      memberCount: sql<number>`count(${groupMembers.id})::int`,
    })
    .from(groups)
    .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(ownerFilter)
    .groupBy(groups.id);

  return rows;
}

/**
 * Lists all recipients that belong to a specific group.
 * Verifies the group is owned by the current buyer.
 */
export async function listGroupMembers(groupId: string) {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) throw new Error('no_identity');

  const ownerFilter = id.userId
    ? eq(groups.ownerUserId, id.userId)
    : eq(groups.anonOwnerId, id.anonId!);

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), ownerFilter))
    .limit(1);

  if (!group) throw new Error('group_not_found_or_not_owner');

  return db
    .select({ recipient: recipients })
    .from(groupMembers)
    .innerJoin(recipients, eq(recipients.id, groupMembers.recipientId))
    .where(eq(groupMembers.groupId, groupId));
}
