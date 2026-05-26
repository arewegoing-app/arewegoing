import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { dispatchArtistNotifications } from '@/lib/artists/dispatch';
import { requireCronAuth } from '@/lib/auth/cron';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req, 'artists');
  if (authError) return authError;
  log.info({ job: 'artists' }, 'cron.artists.start');
  await ensureMigrated();
  const result = await dispatchArtistNotifications();
  log.info({ ...result }, 'cron.artists.done');
  return NextResponse.json(result);
}
