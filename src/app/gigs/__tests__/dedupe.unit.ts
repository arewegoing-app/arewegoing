import { strict as assert } from 'node:assert';
import { dedupeEvents } from '../lib/discovery/dedupe';

const same = new Date('2026-08-02T22:00:00.000Z');

// 1. Same gig under two sources with the SAME seriesName → series fast path.
const r1 = dedupeEvents([
  { id: 'h1', title: 'Rhythm Output Presents Bryan Gee Wellington', venue: 'Afters.', seriesName: 'Rhythm Output', startsAt: same, source: 'humanitix', discoveredAt: new Date('2026-05-25T10:00:00.000Z') },
  { id: 'u1', title: 'Rhythm Output Presents Bryan Gee WLG', venue: 'Afters.', seriesName: 'Rhythm Output', startsAt: same, source: 'undertheradar', discoveredAt: new Date('2026-05-25T09:00:00.000Z') },
  { id: 'm1', title: 'Different Event', venue: 'San Fran', seriesName: null, startsAt: new Date('2026-08-02T20:00:00.000Z'), source: 'moshtix', discoveredAt: null },
]);
assert.equal(r1.length, 2);
const winner = r1.find((e) => e.title.includes('Bryan'));
assert.ok(winner);
assert.equal(winner!.source, 'undertheradar');
console.log('OK: same series + same day → 1 row, UTR wins');

// 2. Different days, same series — should NOT dedupe.
const r2 = dedupeEvents([
  { id: 'a', title: 'Goodthings Session', venue: 'BL3', seriesName: 'Goodthings Sessions', startsAt: new Date('2026-06-20T09:00:00.000Z'), source: 'flicket', discoveredAt: null },
  { id: 'b', title: 'Goodthings Session', venue: 'BL3', seriesName: 'Goodthings Sessions', startsAt: new Date('2026-07-25T09:00:00.000Z'), source: 'flicket', discoveredAt: null },
]);
assert.equal(r2.length, 2);
console.log('OK: same series on different days kept as two events');

// 3. The reported bug: "Something Something Club Presents: Cuba Street Tavern Sunday Session"
//    + "Sunday Sessions" — different titles, same series + same day → must dedupe.
const r3 = dedupeEvents([
  { id: 'h', title: 'Something Something Club Presents: Cuba Street Tavern Sunday Session', venue: 'Cuba St Tavern', seriesName: 'Sunday Sessions', startsAt: new Date('2026-05-31T03:00:00.000Z'), source: 'humanitix', discoveredAt: new Date('2026-05-25T10:00:00.000Z') },
  { id: 'u', title: 'Sunday Sessions', venue: 'Cuba St Tavern', seriesName: 'Sunday Sessions', startsAt: new Date('2026-05-31T03:00:00.000Z'), source: 'undertheradar', discoveredAt: new Date('2026-05-25T09:00:00.000Z') },
]);
assert.equal(r3.length, 1, `expected 1 after dedupe, got ${r3.length}`);
assert.equal(r3[0].source, 'undertheradar', 'UTR preferred');
console.log('OK: Cuba St Sunday Sessions deduped via series + day');

// 4. Same venue + day but no series — venue fallback kicks in.
const r4 = dedupeEvents([
  { id: 'p', title: 'Funky Night A', venue: 'Meow', seriesName: null, startsAt: new Date('2026-06-10T09:00:00.000Z'), source: 'flicket', discoveredAt: null },
  { id: 'q', title: 'Funky Night B', venue: 'Meow', seriesName: null, startsAt: new Date('2026-06-10T09:00:00.000Z'), source: 'undertheradar', discoveredAt: null },
]);
assert.equal(r4.length, 1);
assert.equal(r4[0].source, 'undertheradar');
console.log('OK: same venue + same day collapses even with different titles');

// 5. TBD events with same series collapse.
const r5 = dedupeEvents([
  { id: 'x', title: 'Mystery Gig', venue: null, seriesName: 'Mystery Series', startsAt: null, source: 'humanitix', discoveredAt: null },
  { id: 'y', title: 'Mystery Gig', venue: null, seriesName: 'Mystery Series', startsAt: null, source: 'undertheradar', discoveredAt: null },
]);
assert.equal(r5.length, 1);
console.log('OK: TBD + same series dedupes');

console.log('All dedupe unit tests passed.');
