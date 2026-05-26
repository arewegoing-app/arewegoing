import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { dispatchSeriesNotifications } from '@/lib/series/dispatch';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const required = process.env.CRON_SECRET;
  if (required) {
    const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.nextUrl.searchParams.get('s');
    if (got !== required) {
      log.warn({ job: 'series' }, 'cron.unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  log.info({ job: 'series' }, 'cron.series.start');
  await ensureMigrated();
  const result = await dispatchSeriesNotifications();
  log.info({ ...result }, 'cron.series.done');
  return NextResponse.json(result);
}
