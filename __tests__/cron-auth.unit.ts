/**
 * Unit tests for requireCronAuth (src/lib/auth/cron.ts).
 *
 * Covers the four documented branches plus a regression check that the
 * query-string ?s= fallback was removed in the PR #3 security pass.
 *
 * Run with: npx tsx __tests__/cron-auth.unit.ts
 */

import { strict as assert } from 'node:assert';
import { NextRequest } from 'next/server';

// requireCronAuth only uses process.env and req.headers — no DB, no cookies.
// We can import it and call it directly in a plain Node.js context.

// @types/node marks NODE_ENV as readonly. At runtime the assignment is fine,
// but TypeScript rejects it. Cast through a generic env record to sidestep.
const env = process.env as Record<string, string | undefined>;

function makeReq(
  headers: Record<string, string> = {},
  search = '',
): NextRequest {
  const url = `http://localhost/api/cron/test${search ? `?${search}` : ''}`;
  return new NextRequest(url, { method: 'GET', headers });
}

async function main() {
  const { requireCronAuth } = await import('@/lib/auth/cron');

  // =========================================================================
  // Test 1: Production env + CRON_SECRET unset → 503 cron_not_configured.
  // =========================================================================
  {
    const savedNodeEnv = env.NODE_ENV;
    const savedVercelEnv = process.env.VERCEL_ENV;
    const savedSecret = process.env.CRON_SECRET;
    try {
      // Force production mode via NODE_ENV.
      env.NODE_ENV = 'production';
      delete process.env.VERCEL_ENV;
      delete process.env.CRON_SECRET;

      const result = requireCronAuth(makeReq(), 'test-job');
      assert.ok(result !== null, 'prod + no secret must return a NextResponse, not null');
      assert.equal(result.status, 503);
      const body = await result.json() as { error: string };
      assert.equal(body.error, 'cron_not_configured');
      console.log('OK: Test 1 — production + no CRON_SECRET → 503 cron_not_configured');
    } finally {
      env.NODE_ENV = savedNodeEnv;
      if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv;
      if (savedSecret !== undefined) process.env.CRON_SECRET = savedSecret;
    }
  }

  // =========================================================================
  // Test 2: Non-production env + CRON_SECRET unset → null (request allowed).
  // =========================================================================
  {
    const savedNodeEnv = env.NODE_ENV;
    const savedVercelEnv = process.env.VERCEL_ENV;
    const savedSecret = process.env.CRON_SECRET;
    try {
      env.NODE_ENV = 'test';
      delete process.env.VERCEL_ENV;
      delete process.env.CRON_SECRET;

      const result = requireCronAuth(makeReq(), 'test-job');
      assert.equal(result, null, 'non-prod + no secret must return null (allow request)');
      console.log('OK: Test 2 — non-production + no CRON_SECRET → null (request allowed)');
    } finally {
      env.NODE_ENV = savedNodeEnv;
      if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv;
      if (savedSecret !== undefined) process.env.CRON_SECRET = savedSecret;
    }
  }

  // =========================================================================
  // Test 3: CRON_SECRET set + wrong bearer → 401 unauthorized.
  // =========================================================================
  {
    const savedNodeEnv = env.NODE_ENV;
    const savedVercelEnv = process.env.VERCEL_ENV;
    const savedSecret = process.env.CRON_SECRET;
    try {
      env.NODE_ENV = 'test';
      delete process.env.VERCEL_ENV;
      process.env.CRON_SECRET = 'correct-secret';

      const result = requireCronAuth(
        makeReq({ authorization: 'Bearer wrong-secret' }),
        'test-job',
      );
      assert.ok(result !== null, 'wrong bearer must return a NextResponse, not null');
      assert.equal(result.status, 401);
      const body = await result.json() as { error: string };
      assert.equal(body.error, 'unauthorized');
      console.log('OK: Test 3 — CRON_SECRET set + wrong bearer → 401 unauthorized');
    } finally {
      env.NODE_ENV = savedNodeEnv;
      if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv;
      if (savedSecret !== undefined) {
        process.env.CRON_SECRET = savedSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  }

  // =========================================================================
  // Test 4: CRON_SECRET set + correct bearer → null (request allowed).
  // =========================================================================
  {
    const savedNodeEnv = env.NODE_ENV;
    const savedVercelEnv = process.env.VERCEL_ENV;
    const savedSecret = process.env.CRON_SECRET;
    try {
      env.NODE_ENV = 'test';
      delete process.env.VERCEL_ENV;
      process.env.CRON_SECRET = 'correct-secret';

      const result = requireCronAuth(
        makeReq({ authorization: 'Bearer correct-secret' }),
        'test-job',
      );
      assert.equal(result, null, 'correct bearer must return null (allow request)');
      console.log('OK: Test 4 — CRON_SECRET set + correct bearer → null (request allowed)');
    } finally {
      env.NODE_ENV = savedNodeEnv;
      if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv;
      if (savedSecret !== undefined) {
        process.env.CRON_SECRET = savedSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  }

  // =========================================================================
  // Test 5 (regression): CRON_SECRET set + secret via ?s= query string only
  // → must return 401 (proves the ?s= fallback was removed).
  //
  // Before the security fix, the route read:
  //   req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  //   ?? req.nextUrl.searchParams.get('s')
  // Secrets in URLs land in server access logs and browser history.
  // requireCronAuth is header-only; ?s= must no longer work.
  // =========================================================================
  {
    const savedNodeEnv = env.NODE_ENV;
    const savedVercelEnv = process.env.VERCEL_ENV;
    const savedSecret = process.env.CRON_SECRET;
    try {
      env.NODE_ENV = 'test';
      delete process.env.VERCEL_ENV;
      process.env.CRON_SECRET = 'correct-secret';

      // Pass the correct secret via query string, NOT via Authorization header.
      const result = requireCronAuth(
        makeReq({}, 's=correct-secret'),
        'test-job',
      );
      assert.ok(result !== null, '?s= query-string auth must NOT be allowed (must return a response)');
      assert.equal(result.status, 401, '?s= fallback must return 401, not 200/null');
      console.log('OK: Test 5 (regression) — ?s= query-string fallback is gone → 401');
    } finally {
      env.NODE_ENV = savedNodeEnv;
      if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv;
      if (savedSecret !== undefined) {
        process.env.CRON_SECRET = savedSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  }

  // =========================================================================
  // Test 6 (VERCEL_ENV production path): VERCEL_ENV=production triggers prod
  // behaviour even when NODE_ENV is not 'production'. Covers deploy environments
  // where Next.js sets NODE_ENV='production' but Vercel sets VERCEL_ENV too.
  // We verify the 503 path is reached via VERCEL_ENV alone.
  // =========================================================================
  {
    const savedNodeEnv = env.NODE_ENV;
    const savedVercelEnv = process.env.VERCEL_ENV;
    const savedSecret = process.env.CRON_SECRET;
    try {
      // Keep NODE_ENV as whatever it is — VERCEL_ENV alone should trigger prod gate.
      env.NODE_ENV = 'development';
      process.env.VERCEL_ENV = 'production';
      delete process.env.CRON_SECRET;

      const result = requireCronAuth(makeReq(), 'test-job');
      assert.ok(result !== null, 'VERCEL_ENV=production + no secret must return a response');
      assert.equal(result.status, 503);
      console.log('OK: Test 6 — VERCEL_ENV=production + no CRON_SECRET → 503 (prod gate via VERCEL_ENV)');
    } finally {
      env.NODE_ENV = savedNodeEnv;
      if (savedVercelEnv !== undefined) {
        process.env.VERCEL_ENV = savedVercelEnv;
      } else {
        delete process.env.VERCEL_ENV;
      }
      if (savedSecret !== undefined) {
        process.env.CRON_SECRET = savedSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  }

  console.log('\nAll cron-auth unit tests passed. (6 assertion groups)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
