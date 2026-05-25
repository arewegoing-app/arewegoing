// Smoke test: verify our existing JSON-LD parser handles Eventfinda's
// flat-array layout (Place + Offer[] + PerformingGroup + Event-typed root
// as siblings, no @graph).

import { strict as assert } from 'node:assert';
import { parseHtml } from '../lib/ingest/fetch';

const html = `<!doctype html><html><head>
<title>Raw Meat Monday — Eventfinda</title>
<meta property="og:title" content="Raw Meat Monday - Live Stand Up Comedy" />
<script type="application/ld+json">[
{"@context":"http://schema.org","@type":"Place","@id":"https://www.eventfinda.co.nz/venue/the-fringe-bar-wellington","name":"The Fringe Bar","address":{"@type":"PostalAddress","addressCountry":"New Zealand","addressLocality":"Wellington","streetAddress":"26 Allen Street"}},
{"@context":"http://schema.org","@type":"Offer","@id":"tp_1","name":"General Admission","price":"9.00"},
{"@context":"http://schema.org","@type":"Offer","@id":"tp_2","name":"Support the Artists","price":"15.00"},
{"@context":"http://schema.org","@type":"ComedyEvent","name":"Raw Meat Monday - Live Stand Up Comedy","startDate":"2026-06-15T20:30:00+12:00","location":{"@type":"Place","name":"The Fringe Bar","address":{"@type":"PostalAddress","addressLocality":"Wellington"}},"offers":[{"@type":"Offer","price":"9.00","priceCurrency":"NZD"},{"@type":"Offer","price":"15.00","priceCurrency":"NZD"}]}
]</script>
</head><body></body></html>`;

const r = parseHtml(html, new URL('https://www.eventfinda.co.nz/2026/raw-meat-monday-live-stand-up-comedy3/wellington'));
assert.equal(r.ok, true, JSON.stringify(r));
if (r.ok) {
  assert.equal(r.metadata.source, 'eventfinda');
  assert.equal(r.metadata.title, 'Raw Meat Monday - Live Stand Up Comedy');
  assert.equal(r.metadata.venue, 'The Fringe Bar');
  assert.equal(r.metadata.city, 'Wellington');
  assert.ok(r.metadata.startsAt, 'startsAt extracted');
  assert.equal(r.metadata.priceLow, 9, 'cheapest offer wins');
  console.log('OK: Eventfinda ComedyEvent parsed; cheapest offer = $9');
}

console.log('All Eventfinda unit tests passed.');
