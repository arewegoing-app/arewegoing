// Unit test for features-v2 slice 2: extras + need_ticket reaction kinds.
// Mirrors the setup in series.unit.ts and feature-interest.unit.ts.

import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();
  const schema = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { getReactionTallies } = await import('@/lib/discovery/reactions');

  // Seed: one event, three anon reactors with different new-kind reactions.
  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'rxv2-test', title: 'V2 reactions test', venue: 'BL3 Bar' })
    .returning();

  await db.insert(schema.eventReactions).values([
    { eventId: event.id, anonId: 'a-extras-1', kind: 'extras', extrasCount: 2 },
    { eventId: event.id, anonId: 'a-extras-2', kind: 'extras', extrasCount: 1 },
    { eventId: event.id, anonId: 'a-need-1', kind: 'need_ticket' },
    { eventId: event.id, anonId: 'a-down-1', kind: 'down' },
  ]);

  const tallies = await getReactionTallies([event.id]);
  const t = tallies.get(event.id);
  assert.ok(t, 'tally exists for event');
  assert.equal(t!.extras, 2, `expected 2 extras rows, got ${t!.extras}`);
  assert.equal(t!.need_ticket, 1);
  assert.equal(t!.down, 1);
  console.log('OK: extras + need_ticket counts roll up correctly');

  // ZERO_TALLY shape: every kind present.
  for (const k of [
    'interested',
    'down',
    'cant',
    'pledge_1',
    'pledge_2',
    'have_ticket',
    'extras',
    'need_ticket',
  ] as const) {
    assert.equal(typeof t![k], 'number', `tally has numeric ${k}`);
  }
  console.log('OK: tally includes all 8 reaction kinds');

  // extras_count column persisted with the right value.
  const rows = await db
    .select()
    .from(schema.eventReactions)
    .where(eq(schema.eventReactions.eventId, event.id));
  const extrasRows = rows.filter((r) => r.kind === 'extras');
  const counts = extrasRows.map((r) => r.extrasCount).sort();
  assert.deepEqual(counts, [1, 2], `expected extras_count [1, 2], got ${JSON.stringify(counts)}`);
  console.log('OK: extras_count column persists per-row');

  // Non-extras rows should have null extras_count.
  const needRow = rows.find((r) => r.kind === 'need_ticket')!;
  assert.equal(needRow.extrasCount, null, 'need_ticket row has null extras_count');
  console.log('OK: extras_count is null for non-extras kinds');

  console.log('All reactions-v2 unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
