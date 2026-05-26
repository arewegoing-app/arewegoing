import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { dispatchPostEventFeedback } from '@/lib/notifications/feedback';
import { requireCronAuth } from '@/lib/auth/cron';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req, 'feedback');
  if (authError) return authError;
  log.info({ job: 'feedback' }, 'cron.feedback.start');
  await ensureMigrated();
  const result = await dispatchPostEventFeedback();
  log.info({ ...result }, 'cron.feedback.done');
  return NextResponse.json(result);
}
