import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { discoverFromSeed } from '@/lib/discovery/discover';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requiredSecret = process.env.CRON_SECRET;
  if (requiredSecret) {
    const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? req.nextUrl.searchParams.get('s');
    if (provided !== requiredSecret) {
      log.warn({ job: 'discover' }, 'cron.unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  log.info({ job: 'discover' }, 'cron.discover.start');
  await ensureMigrated();
  const result = await discoverFromSeed();
  log.info({ ...result }, 'cron.discover.done');
  return NextResponse.json(result);
}
