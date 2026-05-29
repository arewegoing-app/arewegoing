import { strict as assert } from 'node:assert';
import { withRef } from '@/lib/outbound/with-ref';

// 1. Bare URL gets ?ref=arewegoing appended.
assert.equal(
  withRef('https://moshtix.co.nz/event/123'),
  'https://moshtix.co.nz/event/123?ref=arewegoing',
);
console.log('OK: bare URL gets ref appended');

// 2. URL with an existing different ref gets it overwritten.
assert.equal(
  withRef('https://example.com/?ref=other'),
  'https://example.com/?ref=arewegoing',
);
console.log('OK: existing ref is replaced (idempotent)');

// 3. URL with other query params preserved + ref added.
const out = withRef('https://example.com/?utm_source=newsletter&id=5');
const u = new URL(out);
assert.equal(u.searchParams.get('ref'), 'arewegoing');
assert.equal(u.searchParams.get('utm_source'), 'newsletter');
assert.equal(u.searchParams.get('id'), '5');
console.log('OK: other params preserved');

// 4. Calling twice is a no-op (idempotent).
assert.equal(
  withRef(withRef('https://example.com/')),
  'https://example.com/?ref=arewegoing',
);
console.log('OK: double-wrap is idempotent');

// 5. Malformed URL passes through unchanged.
assert.equal(withRef('not a url'), 'not a url');
console.log('OK: malformed URL passes through');

// 6. Null / undefined / empty return empty string.
assert.equal(withRef(null), '');
assert.equal(withRef(undefined), '');
assert.equal(withRef(''), '');
console.log('OK: nullish input returns empty string');

console.log('All withRef unit tests passed.');
