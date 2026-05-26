import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { log } from '@/lib/log';

/**
 * Header-only bearer auth for Vercel Cron handlers. Returns a NextResponse
 * to short-circuit when auth fails, or null when the caller is authorised
 * and the route handler should proceed.
 *
 * Behaviour:
 *  - Production: CRON_SECRET must be set. If unset, we return 503 instead of
 *    silently accepting requests (a missed env var was previously enough to
 *    open all cron endpoints to the public).
 *  - Non-production: if CRON_SECRET is unset, auth is skipped. This keeps
 *    local dev frictionless. If CRON_SECRET is set in dev, it's enforced.
 *  - The query-string fallback (?s=) is intentionally not supported. Secrets
 *    in URLs land in access logs, browser history, and HTTP referrers.
 */
export function requireCronAuth(req: NextRequest, job: string): NextResponse | null {
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const requiredSecret = process.env.CRON_SECRET;

  if (!requiredSecret) {
    if (isProd) {
      log.error({ job }, 'cron.misconfigured');
      return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
    }
    return null;
  }

  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== requiredSecret) {
    log.warn({ job }, 'cron.unauthorized');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
