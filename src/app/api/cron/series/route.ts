import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { dispatchSeriesNotifications } from '@/lib/series/dispatch';
import { requireCronAuth } from '@/lib/auth/cron';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req, 'series');
  if (authError) return authError;
  log.info({ job: 'series' }, 'cron.series.start');
  await ensureMigrated();
  const result = await dispatchSeriesNotifications();
  log.info({ ...result }, 'cron.series.done');
  return NextResponse.json(result);
}
