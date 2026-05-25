import { strict as assert } from 'node:assert';
import { dedupeEvents } from '../lib/discovery/dedupe';

const same = new Date('2026-08-02T22:00:00.000Z');

// Same gig listed under two sources.
const result = dedupeEvents([
  { id: 'h1', title: 'Rhythm Output Presents Bryan Gee Wellington', startsAt: same, source: 'humanitix', discoveredAt: new Date('2026-05-25T10:00:00.000Z') },
  { id: 'u1', title: 'Rhythm Output Presents Bryan Gee WLG', startsAt: same, source: 'undertheradar', discoveredAt: new Date('2026-05-25T09:00:00.000Z') },
  { id: 'm1', title: 'Different Event', startsAt: new Date('2026-08-02T20:00:00.000Z'), source: 'moshtix', discoveredAt: null },
]);
assert.equal(result.length, 2, `expected 2 after dedupe, got ${result.length}`);
const winner = result.find((e) => e.title.includes('Bryan'));
assert.ok(winner, 'Bryan event present');
assert.equal(winner!.source, 'undertheradar', 'UTR preferred over Humanitix');
console.log('OK: same gig on two sources → 1 row, UTR wins');

// Different days, same title — should NOT dedupe.
const result2 = dedupeEvents([
  { id: 'a', title: 'Goodthings Session', startsAt: new Date('2026-06-20T09:00:00.000Z'), source: 'flicket', discoveredAt: null },
  { id: 'b', title: 'Goodthings Session', startsAt: new Date('2026-07-25T09:00:00.000Z'), source: 'flicket', discoveredAt: null },
]);
assert.equal(result2.length, 2);
console.log('OK: same title on different days kept as two events');

// Both TBD with same title → dedupe.
const result3 = dedupeEvents([
  { id: 'x', title: 'Mystery Gig', startsAt: null, source: 'humanitix', discoveredAt: null },
  { id: 'y', title: 'Mystery Gig', startsAt: null, source: 'undertheradar', discoveredAt: null },
]);
assert.equal(result3.length, 1);
assert.equal(result3[0].source, 'undertheradar');
console.log('OK: two TBD entries dedupe to one');

console.log('All dedupe unit tests passed.');
