import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret-for-adversarial';

const b64url = (b: Buffer): string =>
  b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

const signRaw = (body: string): string =>
  b64url(createHmac('sha256', process.env.GIGS_TOKEN_SECRET!).update(body).digest());

async function main() {
  const { signToken, verifyToken } = await import('@/lib/tokens/token-service');

  // 1. Empty token rejected.
  {
    const r = verifyToken('');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'malformed');
  }

  // 2. Token with no body separator rejected.
  {
    const r = verifyToken('onlyonepart');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'malformed');
  }

  // 3. Token with three parts rejected.
  {
    const r = verifyToken('a.b.c');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'malformed');
  }

  // 4. Signature crafted with wrong secret is rejected (forgery attempt).
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: 60 });
    const [body] = tok.split('.');
    const forgedSig = b64url(createHmac('sha256', 'WRONG-secret').update(body).digest());
    const r = verifyToken(`${body}.${forgedSig}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid_signature');
  }

  // 5. Sig from token A pasted onto body of token B is rejected.
  {
    const t1 = signToken({ rid: 'attacker', eid: 'e1', act: 'rsvp.in', ttlSec: 60 });
    const t2 = signToken({ rid: 'victim', eid: 'e1', act: 'rsvp.in', ttlSec: 60 });
    const [, sig1] = t1.split('.');
    const [body2, sig2] = t2.split('.');
    const swap = verifyToken(`${body2}.${sig1}`);
    assert.equal(swap.ok, false);
    if (!swap.ok) assert.equal(swap.reason, 'invalid_signature');
    const ok1 = verifyToken(t1);
    const ok2 = verifyToken(`${body2}.${sig2}`);
    assert.equal(ok1.ok, true);
    if (ok1.ok) assert.equal(ok1.payload.rid, 'attacker');
    assert.equal(ok2.ok, true);
    if (ok2.ok) assert.equal(ok2.payload.rid, 'victim');
  }

  // 6. Body bit-flip invalidates the signature.
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: 60 });
    const [body, sig] = tok.split('.');
    const flipped = body.slice(0, -1) + (body.slice(-1) === 'A' ? 'B' : 'A');
    const r = verifyToken(`${flipped}.${sig}`);
    assert.equal(r.ok, false);
  }

  // 7. Expired token rejected even with valid signature.
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: -10 });
    const r = verifyToken(tok);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'expired');
  }

  // 8. Token at the exp boundary rejected as expired after wall clock passes it.
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: 0 });
    await new Promise((res) => setTimeout(res, 1100));
    const r = verifyToken(tok);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'expired');
  }

  // 9. Unknown action enum rejected via schema (forge manually).
  {
    const body = b64url(Buffer.from(JSON.stringify({
      rid: 'r1', eid: 'e1', act: 'admin.takeover', exp: Math.floor(Date.now() / 1000) + 60,
    })));
    const r = verifyToken(`${body}.${signRaw(body)}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'payload');
  }

  // 10. Empty rid rejected via schema min(1).
  {
    const body = b64url(Buffer.from(JSON.stringify({
      rid: '', eid: 'e1', act: 'rsvp.in', exp: Math.floor(Date.now() / 1000) + 60,
    })));
    const r = verifyToken(`${body}.${signRaw(body)}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'payload');
  }

  // 11. Token-with-lid round-trips lid value.
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'bail.claim', lid: 'listing-xyz', ttlSec: 60 });
    const r = verifyToken(tok);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.payload.lid, 'listing-xyz');
  }

  // 12. Token without lid leaves payload.lid undefined.
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'bail.claim', ttlSec: 60 });
    const r = verifyToken(tok);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.payload.lid, undefined);
  }

  // 13. Trailing whitespace/newlines in token rejected (no implicit trim).
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: 60 });
    const r = verifyToken(tok + '\n');
    assert.equal(r.ok, false);
  }

  // 14. Garbage base64 body rejected at JSON parse step.
  {
    const body = '%%not-base64%%';
    const r = verifyToken(`${body}.${signRaw(body)}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'payload');
  }

  // 15. Truncated signature (length mismatch) rejected without crashing.
  {
    const tok = signToken({ rid: 'r1', eid: 'e1', act: 'rsvp.in', ttlSec: 60 });
    const [body, sig] = tok.split('.');
    const r = verifyToken(`${body}.${sig.slice(0, 5)}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid_signature');
  }

  // 16. exp as string (type confusion) rejected.
  {
    const body = b64url(Buffer.from(JSON.stringify({
      rid: 'r1', eid: 'e1', act: 'rsvp.in', exp: '9999999999',
    })));
    const r = verifyToken(`${body}.${signRaw(body)}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'payload');
  }

  console.log('OK: tokens-adversarial (16 scenarios)');
}

main().catch((e) => { console.error(e); process.exit(1); });
