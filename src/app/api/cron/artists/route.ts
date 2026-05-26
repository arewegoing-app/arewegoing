import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { dispatchArtistNotifications } from '@/lib/artists/dispatch';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const required = process.env.CRON_SECRET;
  if (required) {
    const got =
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      req.nextUrl.searchParams.get('s');
    if (got !== required) {
      log.warn({ job: 'artists' }, 'cron.unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  log.info({ job: 'artists' }, 'cron.artists.start');
  await ensureMigrated();
  const result = await dispatchArtistNotifications();
  log.info({ ...result }, 'cron.artists.done');
  return NextResponse.json(result);
}
