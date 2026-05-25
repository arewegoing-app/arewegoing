import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/app/gigs/lib/db/client';
import { dispatchSeriesNotifications } from '@/app/gigs/lib/series/dispatch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const required = process.env.CRON_SECRET;
  if (required) {
    const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.nextUrl.searchParams.get('s');
    if (got !== required) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await ensureMigrated();
  const result = await dispatchSeriesNotifications();
  return NextResponse.json(result);
}
