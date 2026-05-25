import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/app/gigs/lib/db/client';
import { dispatchOverdueReminders } from '@/app/gigs/lib/notifications/reminders';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requiredSecret = process.env.CRON_SECRET;
  if (requiredSecret) {
    const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.nextUrl.searchParams.get('s');
    if (provided !== requiredSecret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await ensureMigrated();
  const result = await dispatchOverdueReminders();
  return NextResponse.json(result);
}
