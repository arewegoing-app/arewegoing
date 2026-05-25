import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/gigs/lib/db/client';
import { eventFeedback, eventInvites, events } from '@/app/gigs/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { applyTokenRsvp } from '@/app/gigs/lib/rsvp/actions';
import { applyPledgeToken } from '@/app/gigs/lib/rsvp/pledge';
import { applyBailRequestToken, applyResaleClaimToken } from '@/app/gigs/lib/rsvp/resale';
import { applyReactionToken } from '@/app/gigs/lib/discovery/reactions';
import { verifyToken } from '@/app/gigs/lib/tokens/token-service';
import { log } from '../lib/log';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t');
  if (!token) {
    log.warn({ reason: 'no_token' }, 'r.action.rejected');
    return NextResponse.redirect(new URL('/gigs', req.url));
  }
  const v = verifyToken(token);
  if (!v.ok) {
    log.warn({ reason: v.reason }, 'r.action.rejected');
    return NextResponse.redirect(new URL(`/gigs/r/error?reason=${v.reason}`, req.url));
  }

  if (v.payload.act === 'feedback.submit') {
    const ratingParam = req.nextUrl.searchParams.get('rating');
    const rating = ratingParam !== null ? parseInt(ratingParam, 10) : null;
    if (rating === null || isNaN(rating) || rating < 0 || rating > 5) {
      log.warn({ act: v.payload.act, reason: 'malformed' }, 'r.action.rejected');
      return NextResponse.redirect(new URL('/gigs/r/error?reason=malformed', req.url));
    }

    // Find the event_feedback row linked to this recipient + event.
    const [invite] = await db
      .select()
      .from(eventInvites)
      .where(and(eq(eventInvites.eventId, v.payload.eid), eq(eventInvites.recipientId, v.payload.rid)))
      .limit(1);

    if (invite) {
      const [feedbackRow] = await db
        .select()
        .from(eventFeedback)
        .where(
          and(
            eq(eventFeedback.eventId, v.payload.eid),
            eq(eventFeedback.eventInviteId, invite.id),
            isNull(eventFeedback.anonId),
          ),
        )
        .limit(1);

      if (feedbackRow && !feedbackRow.respondedAt) {
        await db
          .update(eventFeedback)
          .set({
            respondedAt: new Date(),
            attended: rating > 0 ? 1 : 0,
            rating: rating > 0 ? rating : null,
          })
          .where(eq(eventFeedback.id, feedbackRow.id));
      }
    }

    log.info({ act: v.payload.act, rid: v.payload.rid, eid: v.payload.eid }, 'r.action.applied');
    return NextResponse.redirect(new URL('/gigs/feedback/thanks', req.url));
  }

  if (v.payload.act.startsWith('react.')) {
    const result = await applyReactionToken(token);
    if (!result.ok) {
      log.warn({ act: v.payload.act, reason: result.reason }, 'r.action.rejected');
      return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
    }
    log.info({ act: v.payload.act, rid: v.payload.rid, eid: v.payload.eid }, 'r.action.applied');
    return NextResponse.redirect(new URL(`/gigs/calendar?reaction=${result.kind}&event=${result.eventSlug}`, req.url));
  }

  if (v.payload.act === 'bail.claim') {
    const result = await applyResaleClaimToken(token);
    if (!result.ok) {
      log.warn({ act: v.payload.act, reason: result.reason }, 'r.action.rejected');
      return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
    }
    log.info({ act: v.payload.act, rid: v.payload.rid, eid: v.payload.eid }, 'r.action.applied');
    const qs = `claimed=1${result.alreadyClaimed ? '&replay=1' : ''}`;
    return NextResponse.redirect(new URL(`/gigs/e/${result.eventSlug}?${qs}`, req.url));
  }

  if (v.payload.act === 'bail.request') {
    const result = await applyBailRequestToken(token);
    if (!result.ok) {
      log.warn({ act: v.payload.act, reason: result.reason }, 'r.action.rejected');
      return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
    }
    log.info({ act: v.payload.act, rid: v.payload.rid, eid: v.payload.eid }, 'r.action.applied');
    return NextResponse.redirect(new URL(`/gigs/dropped`, req.url));
  }

  const isPledge = v.payload.act === 'pledge.confirm' || v.payload.act === 'pledge.drop';
  if (isPledge) {
    const result = await applyPledgeToken(token);
    if (!result.ok) {
      log.warn({ act: v.payload.act, reason: result.reason }, 'r.action.rejected');
      return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
    }
    const [event] = await db.select().from(events).where(eq(events.id, v.payload.eid)).limit(1);
    if (!event) {
      log.warn({ act: v.payload.act, reason: 'event_missing' }, 'r.action.rejected');
      return NextResponse.redirect(new URL('/gigs', req.url));
    }
    log.info({ act: v.payload.act, rid: v.payload.rid, eid: v.payload.eid }, 'r.action.applied');
    const qs = `pledge=${result.action}${result.alreadyConsumed ? '&replay=1' : ''}`;
    return NextResponse.redirect(new URL(`/gigs/e/${event.slug}?${qs}`, req.url));
  }

  const result = await applyTokenRsvp(token);
  if (!result.ok) {
    log.warn({ act: v.payload.act, reason: result.reason }, 'r.action.rejected');
    return NextResponse.redirect(new URL(`/gigs/r/error?reason=${result.reason}`, req.url));
  }
  const [event] = await db.select().from(events).where(eq(events.id, v.payload.eid)).limit(1);
  if (!event) {
    log.warn({ act: v.payload.act, reason: 'event_missing' }, 'r.action.rejected');
    return NextResponse.redirect(new URL('/gigs', req.url));
  }
  log.info({ act: v.payload.act, rid: v.payload.rid, eid: v.payload.eid }, 'r.action.applied');
  return NextResponse.redirect(new URL(`/gigs/e/${event.slug}?status=${result.status}${result.alreadyConsumed ? '&replay=1' : ''}`, req.url));
}
