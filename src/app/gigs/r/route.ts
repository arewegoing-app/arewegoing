import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/gigs/lib/db/client';
import { events } from '@/app/gigs/lib/db/schema';
import { eq } from 'drizzle-orm';
import { applyTokenRsvp } from '@/app/gigs/lib/rsvp/actions';
import { applyPledgeToken } from '@/app/gigs/lib/rsvp/pledge';
import { applyResaleClaimToken } from '@/app/gigs/lib/rsvp/resale';
import { applyReactionToken } from '@/app/gigs/lib/discovery/reactions';
import { verifyToken } from '@/app/gigs/lib/tokens/token-service';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t');
  if (!token) return NextResponse.redirect(new URL('/gigs', req.url));
  const v = verifyToken(token);
  if (!v.ok) return NextResponse.redirect(new URL(`/gigs/r/error?reason=${v.reason}`, req.url));

  if (v.payload.act.startsWith('react.')) {
    const result = await applyReactionToken(token);
    if (!result.ok) return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
    return NextResponse.redirect(new URL(`/gigs/calendar?reaction=${result.kind}&event=${result.eventSlug}`, req.url));
  }

  if (v.payload.act === 'bail.claim') {
    const result = await applyResaleClaimToken(token);
    if (!result.ok) return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
    const qs = `claimed=1${result.alreadyClaimed ? '&replay=1' : ''}`;
    return NextResponse.redirect(new URL(`/gigs/e/${result.eventSlug}?${qs}`, req.url));
  }

  const isPledge = v.payload.act === 'pledge.confirm' || v.payload.act === 'pledge.drop';
  if (isPledge) {
    const result = await applyPledgeToken(token);
    if (!result.ok) return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
    const [event] = await db.select().from(events).where(eq(events.id, v.payload.eid)).limit(1);
    if (!event) return NextResponse.redirect(new URL('/gigs', req.url));
    const qs = `pledge=${result.action}${result.alreadyConsumed ? '&replay=1' : ''}`;
    return NextResponse.redirect(new URL(`/gigs/e/${event.slug}?${qs}`, req.url));
  }

  const result = await applyTokenRsvp(token);
  if (!result.ok) return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
  const [event] = await db.select().from(events).where(eq(events.id, v.payload.eid)).limit(1);
  if (!event) return NextResponse.redirect(new URL('/gigs', req.url));
  return NextResponse.redirect(new URL(`/gigs/e/${event.slug}?status=${result.status}${result.alreadyConsumed ? '&replay=1' : ''}`, req.url));
}
