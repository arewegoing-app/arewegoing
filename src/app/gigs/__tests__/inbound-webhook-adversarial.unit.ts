/**
 * Adversarial unit tests for the inbound email webhook
 * (src/app/gigs/api/inbound/email/route.ts).
 *
 * Covers bearer-token auth, payload validation, and sender resolution.
 * Does NOT fully exercise event ingestion — parser is exercised separately
 * in email-forward.unit.ts.
 */
import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'test';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const FIXTURES = join(process.cwd(), 'src/app/gigs/__tests__/fixtures/inbound');

interface InboundFixture {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const loadFixture = (name: string): InboundFixture =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as InboundFixture;

const makeReq = (
  body: string,
  headers: Record<string, string> = {},
): import('next/server').NextRequest => {
  // Lazy-required so NextRequest constructor is available without top-level await.
  const { NextRequest } =
    require('next/server') as typeof import('next/server');
  return new NextRequest('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
};

async function main() {
  // 1. INBOUND_SECRET unset → 503 inbound_not_configured.
  {
    delete process.env.INBOUND_SECRET;
    delete process.env.INBOUND_AUTH_OFF;
    const { POST } = await import('../api/inbound/email/route');
    const res = await POST(makeReq('{}'));
    assert.equal(res.status, 503);
    const json = await res.json();
    assert.equal(json.error, 'inbound_not_configured');
    console.log('OK: 503 when INBOUND_SECRET is unset');
  }

  // 2. INBOUND_SECRET unset but INBOUND_AUTH_OFF=1 → bypass auth, hit parsing.
  {
    delete process.env.INBOUND_SECRET;
    process.env.INBOUND_AUTH_OFF = '1';
    const { POST } = await import('../api/inbound/email/route');
    // Empty JSON body → fails schema validation, returns 400 invalid_payload.
    // Proves the auth check was bypassed.
    const res = await POST(makeReq('{}'));
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.reason, 'invalid_payload');
    console.log('OK: INBOUND_AUTH_OFF=1 bypasses auth');
    delete process.env.INBOUND_AUTH_OFF;
  }

  // 3. INBOUND_SECRET set, no Authorization header → 401.
  {
    process.env.INBOUND_SECRET = 'test-inbound';
    const { POST } = await import('../api/inbound/email/route');
    const res = await POST(makeReq('{}'));
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.error, 'unauthorized');
    console.log('OK: 401 with no Authorization header');
  }

  // 4. INBOUND_SECRET set, wrong bearer → 401.
  {
    process.env.INBOUND_SECRET = 'test-inbound';
    const { POST } = await import('../api/inbound/email/route');
    const res = await POST(
      makeReq('{}', { authorization: 'Bearer wrong-secret' }),
    );
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.error, 'unauthorized');
    console.log('OK: 401 with wrong bearer');
  }

  // 5. INBOUND_SECRET set, correct bearer, malformed JSON → 400 invalid_json.
  {
    process.env.INBOUND_SECRET = 'test-inbound';
    const { POST } = await import('../api/inbound/email/route');
    const res = await POST(
      makeReq('{not json', { authorization: 'Bearer test-inbound' }),
    );
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.reason, 'invalid_json');
    console.log('OK: 400 invalid_json on malformed body');
  }

  // 6. INBOUND_SECRET set, correct bearer, JSON missing required `from` → 400.
  {
    process.env.INBOUND_SECRET = 'test-inbound';
    const { POST } = await import('../api/inbound/email/route');
    const res = await POST(
      makeReq(
        JSON.stringify({ to: 'x@y', subject: 's', text: 't', html: 'h' }),
        { authorization: 'Bearer test-inbound' },
      ),
    );
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.reason, 'invalid_payload');
    console.log('OK: 400 invalid_payload when "from" missing');
  }

  // 7. Valid payload, parser succeeds, sender not in users table → unknown_sender.
  // The humanitix fixture has from=order@humanitix.com. The parser accepts it
  // (vendor regex match), then the route resolves the same address against the
  // users table. With no matching user, route returns unknown_sender.
  {
    process.env.INBOUND_SECRET = 'test-inbound';
    const { POST } = await import('../api/inbound/email/route');
    const fixture = loadFixture('humanitix-order.json');
    const res = await POST(
      makeReq(JSON.stringify(fixture), {
        authorization: 'Bearer test-inbound',
      }),
    );
    // 200 by route convention — body carries the failure reason.
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.reason, 'unknown_sender');
    console.log('OK: unknown_sender for unregistered "from" address');
  }

  // 8. `from: "Display Name <user@x>"` parses bare address case-insensitively.
  // Seed a user whose stored email matches the bare address (lowercase). Send
  // a `from` header in display-name format with MIXED-CASE address. The route
  // must extract `<addr>`, lowercase it, and resolve to the seeded user.
  {
    process.env.INBOUND_SECRET = 'test-inbound';
    const { db, ensureMigrated } = await import('../lib/db/client');
    await ensureMigrated();
    const schema = await import('../lib/db/schema');
    // The humanitix parser keys off /order@humanitix\.com$/i, so we seed a
    // user with that lowercase address and use it as the bare from-address.
    await db
      .insert(schema.users)
      .values({ email: 'order@humanitix.com', name: 'Humanitix Bot' });

    const { POST } = await import('../api/inbound/email/route');
    const fixture = loadFixture('humanitix-order.json');
    // Display-name wrapper + mixed-case address. Parser regex is /i so it
    // still matches; route must lowercase for the user lookup.
    fixture.from = 'Humanitix Orders <ORDER@Humanitix.COM>';
    const res = await POST(
      makeReq(JSON.stringify(fixture), {
        authorization: 'Bearer test-inbound',
      }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    // Must NOT be unknown_sender — the address was extracted and lowercased.
    assert.notEqual(
      json.reason,
      'unknown_sender',
      `expected sender to resolve, got reason="${json.reason}"`,
    );
    console.log('OK: display-name + mixed-case "from" resolves to user');
  }

  console.log('All inbound-webhook-adversarial unit tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
