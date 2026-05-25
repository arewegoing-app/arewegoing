import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/app/gigs/lib/db/client';
import { dispatchPostEventFeedback } from '@/app/gigs/lib/notifications/feedback';
import { log } from '../../../lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requiredSecret = process.env.CRON_SECRET;
  if (requiredSecret) {
    const provided =
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      req.nextUrl.searchParams.get('s');
    if (provided !== requiredSecret) {
      log.warn({ job: 'feedback' }, 'cron.unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  log.info({ job: 'feedback' }, 'cron.feedback.start');
  await ensureMigrated();
  const result = await dispatchPostEventFeedback();
  log.info({ ...result }, 'cron.feedback.done');
  return NextResponse.json(result);
}
