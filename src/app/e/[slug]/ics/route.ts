import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/lib/db/client';
import { events } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

// Default gig duration if the source didn't give us an end time.
const DEFAULT_DURATION_HOURS = 4;

export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  await ensureMigrated();
  const { slug } = await ctx.params;
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) return new NextResponse('Not found', { status: 404 });

  const startsAt = event.startsAt ? new Date(event.startsAt) : null;
  const endsAt = startsAt ? new Date(startsAt.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000) : null;
  const now = new Date();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//gigs//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@gigs.local`,
    `DTSTAMP:${fmtIcs(now)}`,
    startsAt && `DTSTART:${fmtIcs(startsAt)}`,
    endsAt && `DTEND:${fmtIcs(endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    event.venue ? `LOCATION:${escapeIcs([event.venue, event.city].filter(Boolean).join(', '))}` : null,
    `URL:${event.ticketUrl ?? event.sourceUrl ?? ''}`,
    `DESCRIPTION:${escapeIcs(
      [
        event.title,
        event.venue ? `Venue: ${event.venue}` : null,
        event.ticketUrl ? `Tickets: ${event.ticketUrl}` : null,
      ]
        .filter(Boolean)
        .join('\\n'),
    )}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const body = lines.join('\r\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}.ics"`,
      'cache-control': 'public, max-age=300',
    },
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtIcs(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
