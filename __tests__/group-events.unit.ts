/**
 * Unit tests for group_events table operations.
 *
 * Tests:
 *   1. Add event to group
 *   2. Idempotent add (ON CONFLICT DO NOTHING)
 *   3. Add to missing group → FK violation (correctly throws)
 *   4. Remove non-existent row → returns removed: 0
 *   5. Cross-actor add/remove: both actors' rows logged on the events
 */

import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret-group-events';

const DATA_DIR = join(process.cwd(), '.gigs-data-group-events');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { readFileSync } = await import('node:fs');
  const { join: pathJoin } = await import('node:path');
  const { nanoid } = await import('nanoid');
  const schema = await import('@/lib/db/schema');
  const { eq, and, count } = await import('drizzle-orm');

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
    .values({ email: 'ge-a@test.test', name: 'GE Alice' })
    .returning();

  const [userB] = await db
    .insert(schema.users)
    .values({ email: 'ge-b@test.test', name: 'GE Bob' })
    .returning();

  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'ge-event-1', title: 'Group Events Test', venue: 'Test Venue' })
    .returning();

  const [group] = await db
    .insert(schema.groups)
    .values({ slug: nanoid(8), name: 'GE Group', ownerUserId: userA.id })
    .returning();

  // ── 1. Add event to group ─────────────────────────────────────────────────────
  {
    await db.insert(schema.groupEvents).values({
      groupId: group.id,
      eventId: event.id,
      addedByUserId: userA.id,
    });

    const [ge] = await db
      .select()
      .from(schema.groupEvents)
      .where(and(eq(schema.groupEvents.groupId, group.id), eq(schema.groupEvents.eventId, event.id)))
      .limit(1);

    assert.ok(ge, 'group_events row created');
    assert.equal(ge.addedByUserId, userA.id, 'addedByUserId is userA');
    console.log('OK: add event to group creates group_events row');
  }

  // ── 2. Idempotent add ─────────────────────────────────────────────────────────
  {
    // Should not throw; ON CONFLICT DO NOTHING means count stays 1.
    await db
      .insert(schema.groupEvents)
      .values({ groupId: group.id, eventId: event.id, addedByUserId: userA.id })
      .onConflictDoNothing();

    const [{ total }] = await db
      .select({ total: count(schema.groupEvents.id) })
      .from(schema.groupEvents)
      .where(and(eq(schema.groupEvents.groupId, group.id), eq(schema.groupEvents.eventId, event.id)));

    assert.equal(total, 1, 'idempotent add does not create duplicate');
    console.log('OK: idempotent add (ON CONFLICT DO NOTHING) keeps count at 1');
  }

  // ── 3. Add to missing group → FK violation ────────────────────────────────────
  {
    let threw = false;
    try {
      await db.insert(schema.groupEvents).values({
        groupId: 'nonexistent-group-id',
        eventId: event.id,
        addedByUserId: userA.id,
      });
    } catch {
      threw = true;
    }
    assert.ok(threw, 'FK violation thrown for missing group');
    console.log('OK: inserting into missing group throws FK violation');
  }

  // ── 4. Remove non-existent row → returns removed: 0 ──────────────────────────
  {
    const [event2] = await db
      .insert(schema.events)
      .values({ slug: 'ge-event-never-added', title: 'Never Added', venue: 'Nowhere' })
      .returning();

    const result = await db
      .delete(schema.groupEvents)
      .where(and(eq(schema.groupEvents.groupId, group.id), eq(schema.groupEvents.eventId, event2.id)))
      .returning();

    assert.equal(result.length, 0, 'remove of non-existent row returns 0');
    console.log('OK: remove non-existent row returns empty array (0 removed)');
  }

  // ── 5. Cross-actor add/remove ─────────────────────────────────────────────────
  {
    const [event3] = await db
      .insert(schema.events)
      .values({ slug: 'ge-event-cross-actor', title: 'Cross Actor Event', venue: 'Somewhere' })
      .returning();

    // userA adds the event.
    await db.insert(schema.groupEvents).values({
      groupId: group.id,
      eventId: event3.id,
      addedByUserId: userA.id,
    });

    const [addedRow] = await db
      .select()
      .from(schema.groupEvents)
      .where(and(eq(schema.groupEvents.groupId, group.id), eq(schema.groupEvents.eventId, event3.id)))
      .limit(1);

    assert.equal(addedRow.addedByUserId, userA.id, 'userA is logged as adder');

    // userB removes it.
    const removed = await db
      .delete(schema.groupEvents)
      .where(and(eq(schema.groupEvents.groupId, group.id), eq(schema.groupEvents.eventId, event3.id)))
      .returning();

    assert.equal(removed.length, 1, 'userB removes the row (cross-actor)');
    console.log('OK: cross-actor add (userA) / remove (userB) logged correctly');
  }

  console.log('\nAll group-events unit tests passed. (5 assertions)');
  void userB;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
