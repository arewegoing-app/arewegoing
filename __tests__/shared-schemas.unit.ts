/**
 * Exhaustive unit tests for src/lib/shared/schemas.ts.
 *
 * Pure-function tests — no DB, no network, no Playwright.
 * Run with: pnpm test:unit -- shared-schemas
 */
import {
  venueNameSchema,
  artistNameSchema,
  seriesNameSchema,
  producerNameSchema,
  normalizeVenueKey,
  normalizeArtistKey,
  normalizeSeriesKey,
  normalizeProducerKey,
  dedupeByKey,
} from '@/lib/shared/schemas';

let passed = 0;

function ok(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`  OK: ${label}`);
  passed++;
}

function eq<T>(label: string, a: T, b: T): void {
  if (a !== b) throw new Error(`FAIL: ${label}\n  expected: ${JSON.stringify(b)}\n  got:      ${JSON.stringify(a)}`);
  console.log(`  OK: ${label}`);
  passed++;
}

function throws(label: string, fn: () => unknown): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(`FAIL: ${label} — expected an error but none was thrown`);
  console.log(`  OK: ${label}`);
  passed++;
}

// ---------------------------------------------------------------------------
// venueNameSchema
// ---------------------------------------------------------------------------
console.log('\n=== venueNameSchema ===');

{
  const r = venueNameSchema.parse('  San Fran  ');
  eq('trim leading/trailing whitespace', r, 'San Fran');
}

{
  const r = venueNameSchema.parse('San   Fran');
  eq('collapse internal multiple spaces', r, 'San Fran');
}

throws('reject empty string after trim', () => venueNameSchema.parse('   '));
throws('reject string longer than 200 chars', () => venueNameSchema.parse('x'.repeat(201)));

throws('reject control character \\u0000', () => venueNameSchema.parse('Venue\x00Name'));
throws('reject control character \\u0001', () => venueNameSchema.parse('Venue\x01Name'));
throws('reject control character \\u001f', () => venueNameSchema.parse('Venue\x1fName'));
throws('reject control character \\u007f (DEL)', () => venueNameSchema.parse('Venue\x7fName'));

{
  const r = venueNameSchema.parse('Meow 🐈');
  eq('accept emoji in venue name', r, 'Meow 🐈');
}

{
  const withDashes = 'Venue – with em-dash and ‘curly’ quotes';
  const r = venueNameSchema.parse(withDashes);
  eq('accept and preserve en/em-dash and curly quotes', r, withDashes);
}

{
  const r = venueNameSchema.parse('A'.repeat(200));
  eq('accept exactly 200 chars', r.length, 200);
}

// ---------------------------------------------------------------------------
// normalizeVenueKey
// ---------------------------------------------------------------------------
console.log('\n=== normalizeVenueKey ===');

// Case and whitespace insensitivity
eq(
  'case-insensitive: San Fran === san fran',
  normalizeVenueKey('San Fran'),
  normalizeVenueKey('san fran'),
);
eq(
  'whitespace-insensitive: padded San Fran === San Fran',
  normalizeVenueKey('  San   Fran  '),
  normalizeVenueKey('San Fran'),
);

// Abbreviation collapse
eq(
  'St === St. (trailing dot stripped)',
  normalizeVenueKey('St James Theatre'),
  normalizeVenueKey('St. James Theatre'),
);
eq(
  'St === Saint',
  normalizeVenueKey('St James Theatre'),
  normalizeVenueKey('Saint James Theatre'),
);

// Smart quote vs straight quote
eq(
  'smart apostrophe matches straight apostrophe',
  normalizeVenueKey("Sam’s Bar"),
  normalizeVenueKey("Sam's Bar"),
);

// Ampersand / and
ok(
  '& and "and" do not collapse: Pyramid Club !== Pyramid & Co',
  normalizeVenueKey('Pyramid Club') !== normalizeVenueKey('Pyramid & Co'),
);
eq(
  '& collapses to "and": Heaters & Co === Heaters and Co',
  normalizeVenueKey('Heaters & Co'),
  normalizeVenueKey('Heaters and Co'),
);

// Accent folding
eq(
  'accent folding: Café === Cafe',
  normalizeVenueKey('Café'),
  normalizeVenueKey('Cafe'),
);

// Possessive apostrophe folding
eq(
  "possessive 's: Sam's Bar === Sams Bar",
  normalizeVenueKey("Sam's Bar"),
  normalizeVenueKey('Sams Bar'),
);

// Diacritic + emoji: diacritics stripped, emoji preserved
{
  const withDiacritic = normalizeVenueKey('Café 🐈');
  const withoutDiacritic = normalizeVenueKey('Cafe 🐈');
  eq('diacritics stripped but emoji preserved', withDiacritic, withoutDiacritic);
  ok('emoji survives normalization', withDiacritic.includes('🐈'));
}

// Empty / whitespace-only → empty key
eq('empty string → empty key', normalizeVenueKey(''), '');
eq('whitespace-only → empty key', normalizeVenueKey('   '), '');

// ---------------------------------------------------------------------------
// artistNameSchema
// ---------------------------------------------------------------------------
console.log('\n=== artistNameSchema ===');

{
  const r = artistNameSchema.parse('  Bicep  ');
  eq('artist: trim whitespace', r, 'Bicep');
}

{
  const r = artistNameSchema.parse('DJ  Shadow');
  eq('artist: collapse internal spaces', r, 'DJ Shadow');
}

throws('artist: reject empty string', () => artistNameSchema.parse(''));
throws('artist: reject > 200 chars', () => artistNameSchema.parse('a'.repeat(201)));

{
  const r = artistNameSchema.parse('HAIM 🎸');
  eq('artist: accept emoji', r, 'HAIM 🎸');
}

throws('artist: reject control character', () => artistNameSchema.parse('Artist\x00Name'));

// ---------------------------------------------------------------------------
// normalizeArtistKey
// ---------------------------------------------------------------------------
console.log('\n=== normalizeArtistKey ===');

// Case-insensitive
eq(
  'artist key: case-insensitive comparison',
  normalizeArtistKey('BICEP'),
  normalizeArtistKey('Bicep'),
);

// Featuring variants drop the feature from the key; lead artist is the key
eq(
  'featuring: ft. dropped from key',
  normalizeArtistKey('Jane (ft. John)'),
  normalizeArtistKey('Jane'),
);
eq(
  'featuring: feat. dropped from key',
  normalizeArtistKey('Jane feat. John'),
  normalizeArtistKey('Jane'),
);
eq(
  'featuring: featuring dropped from key',
  normalizeArtistKey('Jane featuring John'),
  normalizeArtistKey('Jane'),
);
eq(
  'featuring: ft dropped from key (no dot)',
  normalizeArtistKey('Jane ft John'),
  normalizeArtistKey('Jane'),
);
eq(
  'featuring: all four variants produce same key',
  normalizeArtistKey('Jane (ft. John)'),
  normalizeArtistKey('Jane feat. John'),
);

// "The" prefix dropped
eq(
  'artist key: THE BLACK SEEDS === Black Seeds (The prefix dropped)',
  normalizeArtistKey('THE BLACK SEEDS'),
  normalizeArtistKey('Black Seeds'),
);

// DJ prefix: kept (DJ is part of the identity)
ok(
  'DJ prefix: DJ Shadow !== Shadow (DJ kept)',
  normalizeArtistKey('DJ Shadow') !== normalizeArtistKey('Shadow'),
);

// ---------------------------------------------------------------------------
// seriesNameSchema
// ---------------------------------------------------------------------------
console.log('\n=== seriesNameSchema ===');

{
  const r = seriesNameSchema.parse('  Goodthings Sessions  ');
  eq('series: trim whitespace', r, 'Goodthings Sessions');
}

throws('series: reject empty string', () => seriesNameSchema.parse(''));
throws('series: reject > 200 chars', () => seriesNameSchema.parse('s'.repeat(201)));

{
  const r = seriesNameSchema.parse('Series 🎉');
  eq('series: accept emoji', r, 'Series 🎉');
}

throws('series: reject control character', () => seriesNameSchema.parse('Series\x01Name'));

// ---------------------------------------------------------------------------
// normalizeSeriesKey
// ---------------------------------------------------------------------------
console.log('\n=== normalizeSeriesKey ===');

// Presents/presented-by collapse
eq(
  '"Presents" variant collapses to base name',
  normalizeSeriesKey('Pur x Breakaway Presents'),
  normalizeSeriesKey('Pur x Breakaway'),
);
eq(
  '"presented by" variant collapses to base name',
  normalizeSeriesKey('Pur x Breakaway presented by'),
  normalizeSeriesKey('Pur x Breakaway'),
);

// Ampersand and
eq(
  'series: & === and',
  normalizeSeriesKey('Beats & Pieces'),
  normalizeSeriesKey('Beats and Pieces'),
);

// Year suffixes: keep year (different year = different event)
ok(
  'Splore 2026 !== Splore (year kept in key)',
  normalizeSeriesKey('Splore 2026') !== normalizeSeriesKey('Splore'),
);

// festival/the variant dropped
eq(
  'Homegrown Festival === Homegrown (festival dropped)',
  normalizeSeriesKey('Homegrown Festival'),
  normalizeSeriesKey('Homegrown'),
);
eq(
  '"The" prefix dropped for series',
  normalizeSeriesKey('The Goodthings Sessions'),
  normalizeSeriesKey('Goodthings Sessions'),
);

// Trailing punctuation stripped
eq(
  'trailing ! stripped',
  normalizeSeriesKey('Rave Night!'),
  normalizeSeriesKey('Rave Night'),
);
eq(
  'trailing . stripped',
  normalizeSeriesKey('Rave Night.'),
  normalizeSeriesKey('Rave Night'),
);
eq(
  'trailing … stripped',
  normalizeSeriesKey('Rave Night…'),
  normalizeSeriesKey('Rave Night'),
);

// ---------------------------------------------------------------------------
// producerNameSchema
// ---------------------------------------------------------------------------
console.log('\n=== producerNameSchema ===');

{
  const r = producerNameSchema.parse('  Live Nation NZ  ');
  eq('producer: trim whitespace', r, 'Live Nation NZ');
}

throws('producer: reject empty string', () => producerNameSchema.parse(''));
throws('producer: reject > 200 chars', () => producerNameSchema.parse('p'.repeat(201)));

throws('producer: reject control character', () => producerNameSchema.parse('Corp\x00Name'));

// ---------------------------------------------------------------------------
// normalizeProducerKey
// ---------------------------------------------------------------------------
console.log('\n=== normalizeProducerKey ===');

// Legal suffix stripping
eq(
  'Ltd stripped from key',
  normalizeProducerKey('Eccles Entertainment Ltd'),
  normalizeProducerKey('Eccles Entertainment'),
);
eq(
  'Limited stripped from key',
  normalizeProducerKey('Eccles Entertainment Limited'),
  normalizeProducerKey('Eccles Entertainment'),
);
eq(
  'LLC stripped from key',
  normalizeProducerKey('Big Shows LLC'),
  normalizeProducerKey('Big Shows'),
);
eq(
  'Inc stripped from key',
  normalizeProducerKey('Big Shows Inc'),
  normalizeProducerKey('Big Shows'),
);
eq(
  'Pty stripped from key',
  normalizeProducerKey('Big Shows Pty'),
  normalizeProducerKey('Big Shows'),
);
eq(
  'NZ stripped from key',
  normalizeProducerKey('Live Nation NZ'),
  normalizeProducerKey('Live Nation'),
);
eq(
  'Ltd. (with dot) stripped from key',
  normalizeProducerKey('Eccles Entertainment Ltd.'),
  normalizeProducerKey('Eccles Entertainment'),
);

// Preserve display value (schema does not strip suffixes)
{
  const r = producerNameSchema.parse('Eccles Entertainment Ltd');
  eq('producer display value preserves Ltd', r, 'Eccles Entertainment Ltd');
}

// Case insensitive
eq(
  'producer key: case-insensitive',
  normalizeProducerKey('LIVE NATION NZ'),
  normalizeProducerKey('Live Nation NZ'),
);

// Ampersand / and
eq(
  'producer: & === and',
  normalizeProducerKey('Pur & Breakaway Productions'),
  normalizeProducerKey('Pur and Breakaway Productions'),
);

// Whitespace
eq(
  'producer: extra whitespace normalized',
  normalizeProducerKey('  Live   Nation  '),
  normalizeProducerKey('Live Nation'),
);

// ---------------------------------------------------------------------------
// dedupeByKey
// ---------------------------------------------------------------------------
console.log('\n=== dedupeByKey ===');

type Row = { venue: string; score: number };

// Basic dedupe
{
  const rows: Row[] = [
    { venue: 'San Fran', score: 1 },
    { venue: 'san fran', score: 2 },
    { venue: 'Powerstation', score: 3 },
  ];
  const result = dedupeByKey(rows, (r) => normalizeVenueKey(r.venue));
  eq('dedupeByKey: two same-key rows + one unique → 2 rows', result.length, 2);
}

// Tie-breaker: prefer highest score
{
  const rows: Row[] = [
    { venue: 'San Fran', score: 1 },
    { venue: 'san fran', score: 5 },
    { venue: 'san fran', score: 3 },
  ];
  const result = dedupeByKey(rows, (r) => normalizeVenueKey(r.venue), (a, b) => b.score - a.score);
  eq('dedupeByKey: tie-breaker keeps highest score row', result.length, 1);
  eq('dedupeByKey: highest score wins', result[0].score, 5);
}

// Empty input
{
  const result = dedupeByKey([] as Row[], (r) => r.venue);
  eq('dedupeByKey: empty input → empty output', result.length, 0);
}

// All same key → 1 row
{
  const rows: Row[] = [
    { venue: 'San Fran', score: 1 },
    { venue: 'San Fran', score: 2 },
    { venue: 'San Fran', score: 3 },
  ];
  const result = dedupeByKey(rows, (r) => r.venue);
  eq('dedupeByKey: all same key → 1 row', result.length, 1);
}

// No tie-breaker: first row wins when keys are equal
{
  const rows: Row[] = [
    { venue: 'San Fran', score: 99 },
    { venue: 'San Fran', score: 1 },
  ];
  const result = dedupeByKey(rows, (r) => r.venue);
  eq('dedupeByKey: no tie-breaker → first row wins', result[0].score, 99);
}

// Perf smoke: 100k rows, high duplication
{
  const skip = process.env.CI === 'true';
  if (skip) {
    console.log('  SKIP: 100k perf smoke (CI=true)');
  } else {
    const bigRows: Row[] = Array.from({ length: 100_000 }, (_, i) => ({
      venue: `Venue ${i % 500}`,
      score: i,
    }));
    const start = Date.now();
    const result = dedupeByKey(bigRows, (r) => r.venue);
    const elapsed = Date.now() - start;
    eq('dedupeByKey perf smoke: 100k rows → 500 unique', result.length, 500);
    ok(`dedupeByKey perf smoke: completes under 200ms (took ${elapsed}ms)`, elapsed < 200);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\nAll ${passed} shared-schemas unit tests passed.`);
