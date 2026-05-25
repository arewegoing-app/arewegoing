import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/app/gigs/lib/db/client';
import { dispatchOverdueReminders } from '@/app/gigs/lib/notifications/reminders';
import { log } from '../../../lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requiredSecret = process.env.CRON_SECRET;
  if (requiredSecret) {
    const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.nextUrl.searchParams.get('s');
    if (provided !== requiredSecret) {
      log.warn({ job: 'reminders' }, 'cron.unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  log.info({ job: 'reminders' }, 'cron.reminders.start');
  await ensureMigrated();
  const result = await dispatchOverdueReminders();
  log.info({ ...result }, 'cron.reminders.done');
  return NextResponse.json(result);
}
