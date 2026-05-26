import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { IngestResult } from '@/lib/ingest/types';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

// These URLs are intentionally fictional (high gig IDs, -unit-test suffix) so
// they never collide with the knownEvents seed that runs inside ensureMigrated().
const FIXTURES: Record<string, IngestResult> = {
  'https://www.undertheradar.co.nz/gig/999660/Lacuna-Presents-Eden-Burns-At-The-Gods.utr': {
    ok: true,
    metadata: {
      title: 'Lacuna Presents: Eden Burns At The Gods',
      venue: 'The Gods Paramount',
      city: 'Wellington',
      startsAt: '2026-06-06T21:00:00.000Z',
      priceLow: 40,
      ticketUrl: 'https://www.undertheradar.co.nz/gig/999660/Lacuna-Presents-Eden-Burns-At-The-Gods.utr',
      source: 'undertheradar',
    },
  },
  'https://www.undertheradar.co.nz/gig/999720/Doc-Scott-UK.utr': {
    ok: true,
    metadata: {
      title: 'Doc Scott (UK)',
      venue: 'San Fran',
      city: 'Wellington',
      startsAt: '2026-07-18T22:00:00.000Z',
      priceLow: 55,
      ticketUrl: 'https://www.undertheradar.co.nz/gig/999720/Doc-Scott-UK.utr',
      source: 'undertheradar',
    },
  },
  'https://events.humanitix.com/bryan-gee-wlg-unit-test': {
    ok: true,
    metadata: {
      title: 'Rhythm Output Presents Bryan Gee Wellington',
      venue: 'Cuba Street Tavern',
      city: 'Wellington',
      startsAt: '2026-08-02T22:00:00.000Z',
      priceLow: 35,
      ticketUrl: 'https://events.humanitix.com/bryan-gee-wlg-unit-test',
      source: 'humanitix',
    },
  },
  'https://broken.invalid/event': { ok: false, reason: 'fetch_failed' },
};

const mockIngest = async (url: string): Promise<IngestResult> => FIXTURES[url] ?? { ok: false, reason: 'no_metadata' };

// The successful fixture URLs (the 3 that are expected to be inserted).
const SUCCESS_URLS = Object.entries(FIXTURES)
  .filter(([, v]) => v.ok)
  .map(([k]) => k);

async function main() {
  // Regression guard for the bug fixed in PR #3: ensure none of the fictional
  // test URLs has accidentally been added to the real seed list, which would
  // pre-populate them via ensureMigrated() and shadow the discover insert path.
  const { knownEvents } = await import('@/lib/discovery/known-events');
  const seedUrls = new Set(knownEvents.map((e) => e.sourceUrl));
  for (const u of SUCCESS_URLS) {
    assert.ok(!seedUrls.has(u), `fixture URL collides with knownEvents seed: ${u}`);
  }

  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();
  const { eq, inArray } = await import('drizzle-orm');
  const schema = await import('@/lib/db/schema');
  const { discoverFromSeed } = await import('@/lib/discovery/discover');

  const urls = Object.keys(FIXTURES);
  const res1 = await discoverFromSeed(urls, { ingestImpl: mockIngest });
  assert.equal(res1.attempted, 4);
  assert.equal(res1.inserted, 3);
  assert.equal(res1.failed.length, 1);
  console.log('OK: first run inserts 3, fails 1');

  // Scope queries to the fixture sourceUrls so pre-seeded knownEvents rows
  // (inserted by ensureMigrated) don't inflate the counts.
  const utrUrls = SUCCESS_URLS.filter((u) => u.includes('undertheradar'));
  const allDiscovered = await db.select().from(schema.events)
    .where(inArray(schema.events.sourceUrl, utrUrls));
  assert.equal(allDiscovered.length, 2);
  for (const e of allDiscovered) {
    assert.ok(e.discoveredAt, 'discoveredAt set');
    assert.equal(e.ownerUserId, null, 'no owner');
    assert.ok(e.sourceUrl, 'sourceUrl set');
  }
  console.log('OK: discovered events have no owner + have discoveredAt');

  const lacuna = allDiscovered.find((e) => e.title.startsWith('Lacuna'));
  assert.ok(lacuna);
  assert.equal(lacuna!.seriesName, 'Lacuna Presents');
  console.log('OK: Lacuna series detected');

  const humanitixUrls = SUCCESS_URLS.filter((u) => u.includes('humanitix'));
  const bryan = await db.select().from(schema.events)
    .where(inArray(schema.events.sourceUrl, humanitixUrls));
  assert.equal(bryan.length, 1);
  assert.equal(bryan[0].seriesName, 'Rhythm Output');
  assert.equal(bryan[0].venue, 'Cuba Street Tavern');
  console.log('OK: Rhythm Output series + Cuba Street Tavern venue normalized');

  // Idempotency — scope total count to fixture URLs only.
  const res2 = await discoverFromSeed(urls, { ingestImpl: mockIngest });
  assert.equal(res2.inserted, 0);
  assert.equal(res2.updated, 3);
  const totalAfterRerun = await db.select().from(schema.events)
    .where(inArray(schema.events.sourceUrl, SUCCESS_URLS));
  assert.equal(totalAfterRerun.length, 3);
  console.log('OK: re-run updates instead of inserting duplicates');

  console.log('All discover unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
