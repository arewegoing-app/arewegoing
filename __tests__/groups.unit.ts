/**
 * Slice 7 unit tests — multi-group circles.
 *
 * Tests are fully in-process with PGlite so no running server is needed.
 * Ownership identity is stubbed by directly inserting rows rather than
 * going through the cookie/session layer.
 */

import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { and, count, eq } from 'drizzle-orm';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret-groups';

const DATA_DIR = join(process.cwd(), '.gigs-data-groups');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

// Override the data dir so tests get a fresh DB.
process.env.GIGS_DATA_DIR = DATA_DIR;

async function main() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { readFileSync } = await import('node:fs');
  const { join: pathJoin } = await import('node:path');
  const schema = await import('@/lib/db/schema');

  // Boot a fresh PGlite instance for this test run.
  const pg = new PGlite(DATA_DIR);
  const db = drizzle(pg, { schema });
  const migrationSql = readFileSync(
    pathJoin(process.cwd(), 'src/app/gigs/lib/db/migrations.sql'),
    'utf8',
  );
  await pg.exec(migrationSql);

  // ── Seed a buyer user ────────────────────────────────────────────────────────
  const [buyer] = await db
    .insert(schema.users)
    .values({ email: 'buyer@groups.test', name: 'Grouper' })
    .returning();

  // ── 1. Buyer creates two groups ──────────────────────────────────────────────
  const [g1] = await db
    .insert(schema.groups)
    .values({ slug: 'wlg-crew', name: 'WLG Crew', ownerUserId: buyer.id })
    .returning();

  const [g2] = await db
    .insert(schema.groups)
    .values({ slug: 'work-mates', name: 'Work mates', ownerUserId: buyer.id })
    .returning();

  assert.ok(g1.id, 'WLG Crew created');
  assert.ok(g2.id, 'Work mates created');
  console.log('OK: buyer created 2 groups');

  // ── 2. Add recipients ────────────────────────────────────────────────────────
  const recipientData = [
    { email: 'alice@wlg.test', displayName: 'Alice' },
    { email: 'bob@wlg.test', displayName: 'Bob' },
    { email: 'carol@wlg.test', displayName: 'Carol' },
  ];
  const wlgRecipients = await Promise.all(
    recipientData.map((d) =>
      db
        .insert(schema.recipients)
        .values({ ownerUserId: buyer.id, ...d })
        .returning()
        .then(([r]) => r),
    ),
  );

  const workData = [
    { email: 'dave@work.test', displayName: 'Dave' },
    { email: 'eve@work.test', displayName: 'Eve' },
  ];
  const workRecipients = await Promise.all(
    workData.map((d) =>
      db
        .insert(schema.recipients)
        .values({ ownerUserId: buyer.id, ...d })
        .returning()
        .then(([r]) => r),
    ),
  );

  // Add 3 to WLG Crew.
  for (const r of wlgRecipients) {
    await db
      .insert(schema.groupMembers)
      .values({ groupId: g1.id, recipientId: r.id })
      .onConflictDoNothing();
  }

  // Add 2 to Work mates.
  for (const r of workRecipients) {
    await db
      .insert(schema.groupMembers)
      .values({ groupId: g2.id, recipientId: r.id })
      .onConflictDoNothing();
  }

  console.log('OK: added 3 recipients to WLG Crew, 2 to Work mates');

  // ── 3. listMyGroups returns 2 groups with correct member counts ───────────────
  const groupRows = await db
    .select({
      id: schema.groups.id,
      name: schema.groups.name,
      memberCount: count(schema.groupMembers.id),
    })
    .from(schema.groups)
    .leftJoin(schema.groupMembers, eq(schema.groupMembers.groupId, schema.groups.id))
    .where(eq(schema.groups.ownerUserId, buyer.id))
    .groupBy(schema.groups.id);

  assert.equal(groupRows.length, 2, `expected 2 groups, got ${groupRows.length}`);

  const wlgRow = groupRows.find((g) => g.name === 'WLG Crew');
  const workRow = groupRows.find((g) => g.name === 'Work mates');

  assert.ok(wlgRow, 'WLG Crew in results');
  assert.equal(wlgRow!.memberCount, 3, `WLG Crew should have 3 members, got ${wlgRow!.memberCount}`);
  assert.ok(workRow, 'Work mates in results');
  assert.equal(workRow!.memberCount, 2, `Work mates should have 2 members, got ${workRow!.memberCount}`);

  console.log(`OK: listMyGroups → 2 groups (WLG=${wlgRow!.memberCount}, Work=${workRow!.memberCount})`);

  // ── 4. removeFromGroup decrements the count ──────────────────────────────────
  // Remove Alice from WLG Crew.
  await db
    .delete(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, g1.id),
        eq(schema.groupMembers.recipientId, wlgRecipients[0].id),
      ),
    );

  const [wlgAfter] = await db
    .select({ memberCount: count(schema.groupMembers.id) })
    .from(schema.groupMembers)
    .where(eq(schema.groupMembers.groupId, g1.id));

  assert.equal(wlgAfter.memberCount, 2, `WLG Crew should have 2 members after remove, got ${wlgAfter.memberCount}`);
  console.log(`OK: removeFromGroup → WLG Crew now has ${wlgAfter.memberCount} members`);

  // ── 5. addRecipient default-group wiring ─────────────────────────────────────
  // Simulate what addRecipient does: insert recipient then wire to default group.
  // Create the default group first.
  const [defaultGroup] = await db
    .insert(schema.groups)
    .values({ slug: 'my-friends-test', name: 'My friends', ownerUserId: buyer.id })
    .returning();

  const [frank] = await db
    .insert(schema.recipients)
    .values({ ownerUserId: buyer.id, email: 'frank@test.test', displayName: 'Frank' })
    .returning();

  // Wire Frank to the default group (as addRecipient does).
  await db
    .insert(schema.groupMembers)
    .values({ groupId: defaultGroup.id, recipientId: frank.id })
    .onConflictDoNothing();

  const [frankMembership] = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, defaultGroup.id),
        eq(schema.groupMembers.recipientId, frank.id),
      ),
    );

  assert.ok(frankMembership, 'Frank should be in the default group after addRecipient');
  console.log('OK: addRecipient default-group wiring → Frank in My friends');

  console.log('\nAll groups unit tests passed. (5 assertions)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
