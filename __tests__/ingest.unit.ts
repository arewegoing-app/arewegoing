import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHtml, ingest } from '@/lib/ingest/fetch';

const FIXTURES = join(process.cwd(), 'src/app/gigs/__tests__/fixtures');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

function ok<T>(r: { ok: true } | { ok: false; reason: string; message?: string }, label: string): asserts r is { ok: true } & T {
  if (!r.ok) throw new Error(`${label}: expected ok, got ${(r as { reason: string }).reason}: ${(r as { message?: string }).message ?? ''}`);
}

// Humanitix
{
  const html = read('humanitix.html');
  const r = parseHtml(html, new URL('https://www.humanitix.com/event/solid-state-2-0-after-party'));
  ok<{ metadata: { title: string; venue?: string; city?: string; startsAt?: string; priceLow?: number; source: string; ticketUrl: string } }>(r, 'humanitix');
  assert.equal(r.metadata.title, 'Solid State 2.0 - AFTER PARTY');
  assert.equal(r.metadata.venue, 'San Fran');
  assert.equal(r.metadata.city, 'Wellington');
  assert.equal(r.metadata.priceLow, 35);
  assert.equal(r.metadata.source, 'humanitix');
  assert.equal(r.metadata.ticketUrl, 'https://www.humanitix.com/event/solid-state-2-0-after-party');
  console.log('OK: humanitix');
}

// Moshtix
{
  const html = read('moshtix.html');
  const r = parseHtml(html, new URL('https://moshtix.com.au/v2/event/star-time/123'));
  ok(r, 'moshtix');
  assert.ok(r.metadata.title.includes('Star Time'));
  assert.equal(r.metadata.venue, 'San Fran');
  assert.equal(r.metadata.priceLow, 30);
  assert.equal(r.metadata.source, 'moshtix');
  console.log('OK: moshtix');
}

// Under the Radar (no JSON-LD, DOM scrape)
{
  const html = read('undertheradar.html');
  const r = parseHtml(html, new URL('https://www.undertheradar.co.nz/gig/123/Lacuna-Presents-Eden-Burns-At-The-Gods.utr'));
  ok(r, 'utr');
  assert.equal(r.metadata.title, 'Lacuna Presents: Eden Burns At The Gods');
  assert.equal(r.metadata.venue, 'The Gods Paramount');
  assert.equal(r.metadata.city, 'Wellington');
  assert.equal(r.metadata.source, 'undertheradar');
  console.log('OK: undertheradar');
}

// Flicket
{
  const html = read('flicket.html');
  const r = parseHtml(html, new URL('https://meow.flicket.co.nz/event/byron-the-aquarius'));
  ok(r, 'flicket');
  assert.equal(r.metadata.title, 'BYRON THE AQUARIUS (US)');
  assert.equal(r.metadata.venue, 'Meow');
  assert.equal(r.metadata.priceLow, 55);
  assert.equal(r.metadata.source, 'flicket');
  console.log('OK: flicket');
}

async function asyncTests() {
  const fb = await ingest('https://www.facebook.com/events/12345');
  assert.equal(fb.ok, false);
  if (!fb.ok) assert.equal(fb.reason, 'unsupported_source');
  console.log('OK: facebook blocked');

  const bad = await ingest('not-a-url');
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, 'invalid_url');
  console.log('OK: invalid_url');

  console.log('All ingest unit tests passed.');
}
asyncTests().catch((e) => { console.error(e); process.exit(1); });
