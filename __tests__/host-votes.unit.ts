// Unit test for features-v2 slice 7 host-vote store.

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
  const { castHostVote, getHostVoteTally } = await import('@/lib/host_votes/store');

  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'hv-test', title: 'Host vote test', venue: 'BL3 Bar' })
    .returning();

  // Two anon voters pick the same pre-drinks spot, one picks a different one.
  await castHostVote({ actor: { anonId: 'aaa' }, eventId: event.id, kind: 'predrinks', candidateLabel: 'My place' });
  await castHostVote({ actor: { anonId: 'bbb' }, eventId: event.id, kind: 'predrinks', candidateLabel: 'My place' });
  await castHostVote({ actor: { anonId: 'ccc' }, eventId: event.id, kind: 'predrinks', candidateLabel: 'Pub' });
  let t = await getHostVoteTally(event.id, { anonId: 'aaa' });
  assert.equal(t.predrinks.length, 2);
  assert.equal(t.predrinks[0].candidateLabel, 'My place');
  assert.equal(t.predrinks[0].count, 2);
  assert.equal(t.predrinks[0].mine, true);
  assert.equal(t.predrinks[1].candidateLabel, 'Pub');
  assert.equal(t.predrinks[1].mine, false);
  console.log('OK: tally rolls up by candidate; mine flag tracks the calling actor');

  // Same anon switches their vote — should NOT duplicate the row.
  const r = await castHostVote({
    actor: { anonId: 'aaa' },
    eventId: event.id,
    kind: 'predrinks',
    candidateLabel: 'Pub',
  });
  assert.equal(r.switched, true);
  t = await getHostVoteTally(event.id, { anonId: 'aaa' });
  assert.equal(t.predrinks.length, 2);
  // Now Pub has 2 votes (ccc + aaa), My place has 1 (bbb).
  const pub = t.predrinks.find((x) => x.candidateLabel === 'Pub')!;
  const myPlace = t.predrinks.find((x) => x.candidateLabel === 'My place')!;
  assert.equal(pub.count, 2);
  assert.equal(myPlace.count, 1);
  assert.equal(pub.mine, true);
  assert.equal(myPlace.mine, false);
  console.log('OK: re-voting switches the row in place (no duplicates)');

  // Same actor voting same label = no-op.
  const r2 = await castHostVote({
    actor: { anonId: 'aaa' },
    eventId: event.id,
    kind: 'predrinks',
    candidateLabel: 'Pub',
  });
  assert.equal(r2.switched, false);
  console.log('OK: repeat vote for the same label is a no-op');

  // Afters votes are independent from pre-drinks for the same actor.
  await castHostVote({
    actor: { anonId: 'aaa' },
    eventId: event.id,
    kind: 'afters',
    candidateLabel: 'Diner',
  });
  t = await getHostVoteTally(event.id, { anonId: 'aaa' });
  assert.equal(t.afters.length, 1);
  assert.equal(t.afters[0].candidateLabel, 'Diner');
  assert.equal(t.afters[0].mine, true);
  // predrinks tally unchanged
  assert.equal(t.predrinks.length, 2);
  console.log('OK: afters votes are independent of pre-drinks');

  console.log('All host-votes unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
