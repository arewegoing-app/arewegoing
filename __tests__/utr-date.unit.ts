import { strict as assert } from 'node:assert';
import { parseHtml } from '@/lib/ingest/fetch';

const html = `<!doctype html><html><head>
<title>Pally - Under the Radar</title>
<meta property="og:title" content="Pally's - Rhythm For Ribbons" />
</head><body>
<dl>
<dt>When</dt><dd>Sun May 31st, 2026</dd>
<dt>Where</dt><dd>Afters., Wellington</dd>
<dt>Doors open</dt><dd>8:00pm</dd>
<dt>Gig starts</dt><dd>8:00pm</dd>
</dl>
</body></html>`;

const r = parseHtml(html, new URL('https://www.undertheradar.co.nz/gig/102582/Pallys---Rhythm-For-Ribbons.utr'));
assert.equal(r.ok, true);
if (r.ok) {
  assert.equal(r.metadata.title, "Pally's - Rhythm For Ribbons");
  assert.equal(r.metadata.venue, 'Afters.');
  assert.equal(r.metadata.city, 'Wellington');
  assert.ok(r.metadata.startsAt, 'startsAt extracted from When + Gig starts');
  const d = new Date(r.metadata.startsAt!);
  const nz = d.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  assert.match(nz, /Sun.*31.*May.*8:00\s*pm/i);
  console.log('OK: Pally date parsed correctly →', nz);
}

const html2 = `<dl><dt>When</dt><dd>Sat, 06 June 2026</dd><dt>Where</dt><dd>The Gods Paramount, Wellington</dd><dt>Doors open</dt><dd>9:00pm</dd></dl>`;
const r2 = parseHtml(html2, new URL('https://www.undertheradar.co.nz/gig/x/Lacuna.utr'));
assert.equal(r2.ok, false); // no title, so fails validation
console.log('OK: missing title surfaces as no_metadata');

const html3 = `<title>Lacuna Test</title><meta property="og:title" content="Lacuna Test" /><dl><dt>When</dt><dd>Sat, 06 June 2026</dd><dt>Where</dt><dd>The Gods Paramount, Wellington</dd><dt>Gig starts</dt><dd>9:00pm</dd></dl>`;
const r3 = parseHtml(html3, new URL('https://www.undertheradar.co.nz/gig/x/Lacuna.utr'));
assert.equal(r3.ok, true);
if (r3.ok) {
  const d = new Date(r3.metadata.startsAt!);
  const nz = d.toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  assert.match(nz, /Sat.*6.*Jun.*9:00\s*pm/i);
  assert.equal(r3.metadata.venue, 'The Gods Paramount');
  console.log('OK: Lacuna →', nz);
}

console.log('All UTR adapter assertions passed.');
