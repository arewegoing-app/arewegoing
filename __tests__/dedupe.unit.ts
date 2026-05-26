import { strict as assert } from 'node:assert';
import { dedupeEvents } from '@/lib/discovery/dedupe';

// 1. Same gig, same venue + start time — strongest match.
const sameTime = new Date('2026-08-02T22:00:00.000Z');
const r1 = dedupeEvents([
  { id: 'h', title: 'Rhythm Output Presents Bryan Gee Wellington', venue: 'Afters.', seriesName: 'Rhythm Output', startsAt: sameTime, source: 'humanitix', discoveredAt: new Date('2026-05-25T10:00:00.000Z') },
  { id: 'u', title: 'Rhythm Output Presents Bryan Gee WLG', venue: 'Afters.', seriesName: 'Rhythm Output', startsAt: sameTime, source: 'undertheradar', discoveredAt: new Date('2026-05-25T09:00:00.000Z') },
]);
assert.equal(r1.length, 1);
assert.equal(r1[0].source, 'undertheradar');
console.log('OK: same venue + same time → 1 row, UTR wins');

// 2. Same venue + same day but DIFFERENT times — must stay as two events.
const r2 = dedupeEvents([
  { id: 'early', title: 'Early Bird Daytime Clubbing', venue: 'San Fran', seriesName: null, startsAt: new Date('2026-06-13T01:30:00.000Z'), source: 'moshtix', discoveredAt: null },
  { id: 'night', title: 'Pally Late Night', venue: 'San Fran', seriesName: null, startsAt: new Date('2026-06-13T22:00:00.000Z'), source: 'undertheradar', discoveredAt: null },
]);
assert.equal(r2.length, 2);
console.log('OK: different times at same venue stay distinct');

// 3. The Valerie ACE case the user flagged — Moshtix "Techno Night with
//    Valerie Ace" vs UTR "Pur X Breakaway Present: Valerie Ace". Same San
//    Fran, same Sat 6 Jun, same 11pm. Different titles, different series
//    metadata, different platforms. Must dedupe via venue + time.
const valerie = new Date('2026-06-06T11:00:00.000Z');
const r3 = dedupeEvents([
  { id: 'mx', title: 'Techno Night with Valerie ACE (DE)', venue: 'San Fran', seriesName: 'PUR x Breakaway', startsAt: valerie, source: 'moshtix', discoveredAt: null },
  { id: 'utr', title: 'Pur X Breakaway Present: Valerie Ace (DE) and Keepsakes', venue: 'San Fran', seriesName: 'PUR x Breakaway', startsAt: valerie, source: 'undertheradar', discoveredAt: null },
]);
assert.equal(r3.length, 1, 'Valerie ACE should dedupe');
assert.equal(r3[0].source, 'undertheradar');
console.log('OK: Valerie ACE Moshtix + UTR → 1 row via venue + time');

// 4. Cuba St Sunday Sessions — different titles, same series + same day +
//    same venue + same time.
const cuba = new Date('2026-05-31T03:00:00.000Z');
const r4 = dedupeEvents([
  { id: 'h', title: 'Something Something Club Presents: Cuba Street Tavern Sunday Session', venue: 'Cuba St Tavern', seriesName: 'Sunday Sessions', startsAt: cuba, source: 'humanitix', discoveredAt: new Date('2026-05-25T10:00:00.000Z') },
  { id: 'u', title: 'Sunday Sessions', venue: 'Cuba St Tavern', seriesName: 'Sunday Sessions', startsAt: cuba, source: 'undertheradar', discoveredAt: new Date('2026-05-25T09:00:00.000Z') },
]);
assert.equal(r4.length, 1);
console.log('OK: Cuba St Sunday Sessions deduped via venue + time');

// 5. Different days, same series — NOT dedupe.
const r5 = dedupeEvents([
  { id: 'a', title: 'Goodthings Session', venue: 'BL3', seriesName: 'Goodthings Sessions', startsAt: new Date('2026-06-20T09:00:00.000Z'), source: 'flicket', discoveredAt: null },
  { id: 'b', title: 'Goodthings Session', venue: 'BL3', seriesName: 'Goodthings Sessions', startsAt: new Date('2026-07-25T09:00:00.000Z'), source: 'flicket', discoveredAt: null },
]);
assert.equal(r5.length, 2);
console.log('OK: same series, different days kept distinct');

// 6. TBD + same series collapses via tier 2 (series-key fires when no time).
const r6 = dedupeEvents([
  { id: 'x', title: 'Mystery', venue: null, seriesName: 'Mystery Series', startsAt: null, source: 'humanitix', discoveredAt: null },
  { id: 'y', title: 'Mystery', venue: null, seriesName: 'Mystery Series', startsAt: null, source: 'undertheradar', discoveredAt: null },
]);
assert.equal(r6.length, 1);
console.log('OK: TBD + same series collapses');

console.log('All dedupe unit tests passed.');
