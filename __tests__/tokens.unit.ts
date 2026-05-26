import { strict as assert } from 'node:assert';
import { signToken, verifyToken } from '@/lib/tokens/token-service';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const tok = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: 60 });
const ok = verifyToken(tok);
assert.equal(ok.ok, true, 'fresh token should verify');
if (ok.ok) {
  assert.equal(ok.payload.rid, 'r1');
  assert.equal(ok.payload.eid, 'e1');
  assert.equal(ok.payload.act, 'rsvp.in');
}

const tampered = tok.slice(0, -2) + 'XX';
const bad = verifyToken(tampered);
assert.equal(bad.ok, false, 'tampered token should fail');
if (!bad.ok) assert.equal(bad.reason, 'invalid_signature');

const malformed = verifyToken('not-a-token');
assert.equal(malformed.ok, false);
if (!malformed.ok) assert.equal(malformed.reason, 'malformed');

const expired = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: -1 });
const expiredRes = verifyToken(expired);
assert.equal(expiredRes.ok, false);
if (!expiredRes.ok) assert.equal(expiredRes.reason, 'expired');

console.log('OK: tokens.unit (4 assertions)');
