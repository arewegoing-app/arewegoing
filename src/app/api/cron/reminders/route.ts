import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { dispatchOverdueReminders } from '@/lib/notifications/reminders';
import { requireCronAuth } from '@/lib/auth/cron';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req, 'reminders');
  if (authError) return authError;
  log.info({ job: 'reminders' }, 'cron.reminders.start');
  await ensureMigrated();
  const result = await dispatchOverdueReminders();
  log.info({ ...result }, 'cron.reminders.done');
  return NextResponse.json(result);
}
