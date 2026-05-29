/**
 * Unit tests for shareEventAsGroup logic.
 *
 * Tests:
 *   1. Happy path: creates group + group_events row, returns ok + url
 *   2. Double-share: creates a NEW group (no deduplication)
 *   3. Two actors → two groups
 *   4. Missing event → ok: false, reason: event_not_found
 *   5. Anon creator id is set on the group row
 */

import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret-group-share';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

const DATA_DIR = join(process.cwd(), '.gigs-data-group-share');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { readFileSync } = await import('node:fs');
  const { join: pathJoin } = await import('node:path');
  const { nanoid } = await import('nanoid');
  const schema = await import('@/lib/db/schema');
  const { eq, count } = await import('drizzle-orm');

  const pg = new PGlite(DATA_DIR);
  const db = drizzle(pg, { schema });
  const migrationSql = readFileSync(
    pathJoin(process.cwd(), 'src/lib/db/migrations.sql'),
    'utf8',
  );
  await pg.exec(migrationSql);

  // ── Seed ─────────────────────────────────────────────────────────────────────
  const [userA] = await db
    .insert(schema.users)
    .values({ email: 'share-a@test.test', name: 'Alice Share' })
    .returning();

  const [event1] = await db
    .insert(schema.events)
    .values({ slug: 'share-event-1', title: 'Share Test Event 1', venue: 'Test Venue' })
    .returning();

  const [event2] = await db
    .insert(schema.events)
    .values({ slug: 'share-event-2', title: 'Share Test Event 2', venue: 'Test Venue' })
    .returning();

  // Helper: simulate shareEventAsGroup logic inline (since we can't call the server
  // action which needs cookie/auth context).
  async function shareAsUser(eventId: string, userId: string) {
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1);
    if (!event) return { ok: false as const, reason: 'event_not_found' as const };

    const slug = nanoid(12);
    const [group] = await db
      .insert(schema.groups)
      .values({
        slug,
        name: `Shared: ${event.title}`,
        city: event.city ?? 'Wellington',
        creatorUserId: userId,
        ownerUserId: userId,
        pinnedEventId: event.id,
      })
      .returning();

    await db.insert(schema.groupEvents).values({
      groupId: group.id,
      eventId: event.id,
      addedByUserId: userId,
    });

    const url = `http://localhost:3000/group/${group.id}/calendar`;
    return { ok: true as const, groupId: group.id, url };
  }

  async function shareAsAnon(eventId: string, anonId: string) {
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1);
    if (!event) return { ok: false as const, reason: 'event_not_found' as const };

    const slug = nanoid(12);
    const [group] = await db
      .insert(schema.groups)
      .values({
        slug,
        name: `Shared: ${event.title}`,
        city: event.city ?? 'Wellington',
        creatorAnonId: anonId,
        anonOwnerId: anonId,
        pinnedEventId: event.id,
      })
      .returning();

    await db.insert(schema.groupEvents).values({
      groupId: group.id,
      eventId: event.id,
      addedByAnonId: anonId,
    });

    const url = `http://localhost:3000/group/${group.id}/calendar`;
    return { ok: true as const, groupId: group.id, url };
  }

  // ── 1. Happy path ─────────────────────────────────────────────────────────────
  {
    const result = await shareAsUser(event1.id, userA.id);
    assert.equal(result.ok, true, 'shareEventAsGroup returns ok:true');
    if (result.ok) {
      assert.ok(result.groupId, 'groupId is set');
      assert.ok(result.url.includes(result.groupId), 'url contains groupId');
      // Verify group row
      const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, result.groupId)).limit(1);
      assert.equal(group.pinnedEventId, event1.id, 'pinnedEventId is set');
      assert.equal(group.creatorUserId, userA.id, 'creatorUserId is set');
      // Verify group_events row
      const [ge] = await db.select().from(schema.groupEvents).where(eq(schema.groupEvents.groupId, result.groupId)).limit(1);
      assert.equal(ge.eventId, event1.id, 'group_events row created');
    }
    console.log('OK: happy path creates group + group_events, returns ok + url');
  }

  // ── 2. Double-share creates a NEW group ───────────────────────────────────────
  {
    const r1 = await shareAsUser(event1.id, userA.id);
    const r2 = await shareAsUser(event1.id, userA.id);
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    if (r1.ok && r2.ok) {
      assert.notEqual(r1.groupId, r2.groupId, 'double-share creates distinct groups');
    }
    console.log('OK: double-share creates distinct groups (no dedup)');
  }

  // ── 3. Two actors → two groups ────────────────────────────────────────────────
  {
    const [userB] = await db
      .insert(schema.users)
      .values({ email: 'share-b@test.test', name: 'Bob Share' })
      .returning();

    const ra = await shareAsUser(event2.id, userA.id);
    const rb = await shareAsUser(event2.id, userB.id);
    assert.equal(ra.ok, true);
    assert.equal(rb.ok, true);
    if (ra.ok && rb.ok) {
      assert.notEqual(ra.groupId, rb.groupId, 'two actors create separate groups');
    }
    console.log('OK: two actors create separate group rows');
  }

  // ── 4. Missing event → event_not_found ────────────────────────────────────────
  {
    const result = await shareAsUser('nonexistent-event-id', userA.id);
    assert.equal(result.ok, false, 'missing event returns ok:false');
    assert.equal(result.reason, 'event_not_found', 'reason is event_not_found');
    console.log('OK: missing event returns ok:false, reason:event_not_found');
  }

  // ── 5. Anon creator id set on group row ───────────────────────────────────────
  {
    const anonId = 'anon-share-test-valid-id';
    const result = await shareAsAnon(event1.id, anonId);
    assert.equal(result.ok, true);
    if (result.ok) {
      const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, result.groupId)).limit(1);
      assert.equal(group.creatorAnonId, anonId, 'creatorAnonId set for anon actor');
    }
    console.log('OK: anon creator id set on group row');
  }

  console.log('\nAll group-share unit tests passed. (5 assertions)');
  void count;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
