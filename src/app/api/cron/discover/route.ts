import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/client';
import { discoverFromSeed } from '@/lib/discovery/discover';
import { requireCronAuth } from '@/lib/auth/cron';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req, 'discover');
  if (authError) return authError;
  log.info({ job: 'discover' }, 'cron.discover.start');
  await ensureMigrated();
  const result = await discoverFromSeed();
  log.info({ ...result }, 'cron.discover.done');
  return NextResponse.json(result);
}
