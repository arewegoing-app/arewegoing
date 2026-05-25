import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/app/gigs/lib/log';

export const dynamic = 'force-dynamic';

const clientLogSchema = z.object({
  kind: z.enum(['client_error', 'client_event']),
  message: z.string().max(2000).optional(),
  digest: z.string().max(200).optional(),
  stack: z.string().max(8000).optional(),
  url: z.string().max(2000).optional(),
  event: z.string().max(200).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = clientLogSchema.safeParse(body);
  if (!parsed.success) {
    log.warn({ issues: parsed.error.issues }, 'client.log.invalid');
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const d = parsed.data;
  const ctx = {
    userAgent: req.headers.get('user-agent') ?? undefined,
    referer: req.headers.get('referer') ?? undefined,
    ...d,
  };
  if (d.kind === 'client_error') {
    log.error(ctx, 'client.error');
  } else {
    log.info(ctx, 'client.event');
  }
  return NextResponse.json({ ok: true });
}
