import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { IngestResult } from '../lib/ingest/types';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const FIXTURES: Record<string, IngestResult> = {
  'https://www.undertheradar.co.nz/gig/102660/Lacuna-Presents-Eden-Burns-At-The-Gods.utr': {
    ok: true,
    metadata: {
      title: 'Lacuna Presents: Eden Burns At The Gods',
      venue: 'The Gods Paramount',
      city: 'Wellington',
      startsAt: '2026-06-06T21:00:00.000Z',
      priceLow: 40,
      ticketUrl: 'https://www.undertheradar.co.nz/gig/102660/Lacuna-Presents-Eden-Burns-At-The-Gods.utr',
      source: 'undertheradar',
    },
  },
  'https://www.undertheradar.co.nz/gig/102720/Doc-Scott-UK.utr': {
    ok: true,
    metadata: {
      title: 'Doc Scott (UK)',
      venue: 'San Fran',
      city: 'Wellington',
      startsAt: '2026-07-18T22:00:00.000Z',
      priceLow: 55,
      ticketUrl: 'https://www.undertheradar.co.nz/gig/102720/Doc-Scott-UK.utr',
      source: 'undertheradar',
    },
  },
  'https://events.humanitix.com/bryan-gee-wlg': {
    ok: true,
    metadata: {
      title: 'Rhythm Output Presents Bryan Gee Wellington',
      venue: 'Cuba Street Tavern',
      city: 'Wellington',
      startsAt: '2026-08-02T22:00:00.000Z',
      priceLow: 35,
      ticketUrl: 'https://events.humanitix.com/bryan-gee-wlg',
      source: 'humanitix',
    },
  },
  'https://broken.invalid/event': { ok: false, reason: 'fetch_failed' },
};

const mockIngest = async (url: string): Promise<IngestResult> => FIXTURES[url] ?? { ok: false, reason: 'no_metadata' };

async function main() {
  const { db, ensureMigrated } = await import('../lib/db/client');
  await ensureMigrated();
  const { eq } = await import('drizzle-orm');
  const schema = await import('../lib/db/schema');
  const { discoverFromSeed } = await import('../lib/discovery/discover');

  const urls = Object.keys(FIXTURES);
  const res1 = await discoverFromSeed(urls, { ingestImpl: mockIngest });
  assert.equal(res1.attempted, 4);
  assert.equal(res1.inserted, 3);
  assert.equal(res1.failed.length, 1);
  console.log('OK: first run inserts 3, fails 1');

  const allDiscovered = await db.select().from(schema.events).where(eq(schema.events.source, 'undertheradar'));
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

  const bryan = await db.select().from(schema.events).where(eq(schema.events.source, 'humanitix'));
  assert.equal(bryan.length, 1);
  assert.equal(bryan[0].seriesName, 'Rhythm Output');
  assert.equal(bryan[0].venue, 'Cuba Street Tavern');
  console.log('OK: Rhythm Output series + Cuba Street Tavern venue normalized');

  // Idempotency
  const res2 = await discoverFromSeed(urls, { ingestImpl: mockIngest });
  assert.equal(res2.inserted, 0);
  assert.equal(res2.updated, 3);
  const totalAfterRerun = await db.select().from(schema.events);
  assert.equal(totalAfterRerun.length, 3);
  console.log('OK: re-run updates instead of inserting duplicates');

  console.log('All discover unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
