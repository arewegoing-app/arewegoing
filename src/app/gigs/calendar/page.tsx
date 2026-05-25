import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, asc, gte, lte, or, isNull, eq } from 'drizzle-orm';
import { CheckCircle2Icon, EyeIcon, TicketIcon, XCircleIcon } from 'lucide-react';
import { auth } from '../lib/auth/auth';
import { db } from '../lib/db/client';
import { events } from '../lib/db/schema';
import { getReactionTallies } from '../lib/discovery/reactions';
import { CalendarReactions } from './reactions-row';
import { PromoteToRallyForm } from './promote-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';

type EventRow = typeof events.$inferSelect;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ reaction?: string; event?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/gigs/signin');
  const sp = await searchParams;

  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const upcoming = await db
    .select()
    .from(events)
    .where(
      and(
        or(isNull(events.ownerUserId), eq(events.ownerUserId, session.user.id))!,
        gte(events.startsAt, now),
        lte(events.startsAt, ninetyDaysOut),
      )!,
    )
    .orderBy(asc(events.startsAt));

  const tallies = await getReactionTallies(upcoming.map((e) => e.id));
  const grouped = groupByWeek(upcoming);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Next 90 days</h1>
          <p className="text-sm text-muted-foreground">
            Wellington gigs pulled from Humanitix, Moshtix, and Under the Radar.
          </p>
        </div>
        <Link href="/gigs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Your events
        </Link>
      </header>

      {sp.reaction && (
        <div
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          Reaction recorded: <strong>{sp.reaction}</strong>
          {sp.event ? ` on ${sp.event}` : ''}
        </div>
      )}

      {upcoming.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No upcoming events yet. Hit{' '}
            <Link href="/gigs/api/cron/discover" className="text-foreground underline">
              /gigs/api/cron/discover
            </Link>{' '}
            to pull the seed Wellington gigs.
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {grouped.map(({ weekStart, items }) => (
          <section key={weekStart.toISOString()} aria-label={`Week of ${weekStart.toDateString()}`}>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Week of{' '}
              {weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
            </h2>
            <ul className="space-y-3">
              {items.map((e) => (
                <EventCard key={e.id} event={e} tally={tallies.get(e.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function EventCard({
  event,
  tally,
}: {
  event: EventRow;
  tally:
    | { interested: number; down: number; cant: number; pledge_1: number; pledge_2: number }
    | undefined;
}) {
  const t = tally ?? { interested: 0, down: 0, cant: 0, pledge_1: 0, pledge_2: 0 };
  const downCount = t.down + t.pledge_1 + t.pledge_2;
  const readyToRally = downCount >= 3 && !event.ownerUserId;
  return (
    <li>
      <Card>
        <CardHeader className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-medium leading-tight">
                {event.ownerUserId ? (
                  <Link href={`/gigs/e/${event.slug}`} className="hover:underline">
                    {event.title}
                  </Link>
                ) : (
                  event.title
                )}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.venue ?? '—'}
                {event.startsAt
                  ? ' · ' +
                    new Date(event.startsAt).toLocaleString('en-NZ', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : ' · TBD'}
                {event.priceLow ? ` · from $${event.priceLow}` : ''}
              </p>
              {event.seriesName && (
                <Badge variant="secondary" className="mt-1">
                  {event.seriesName}
                </Badge>
              )}
            </div>
            <ReactionTally tally={t} />
          </div>
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {shortUrl(event.ticketUrl)} ↗
            </a>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          <CalendarReactions eventId={event.id} />
        </CardContent>
        {readyToRally && (
          <CardFooter>
            <PromoteToRallyForm eventId={event.id} />
          </CardFooter>
        )}
      </Card>
    </li>
  );
}

function ReactionTally({
  tally,
}: {
  tally: { interested: number; down: number; cant: number; pledge_1: number; pledge_2: number };
}) {
  const items: Array<{ icon: typeof EyeIcon; value: number; label: string }> = [
    { icon: EyeIcon, value: tally.interested, label: 'interested' },
    { icon: CheckCircle2Icon, value: tally.down, label: 'down' },
    { icon: TicketIcon, value: tally.pledge_1 + tally.pledge_2, label: 'pledging' },
    { icon: XCircleIcon, value: tally.cant, label: "can't" },
  ];
  const visible = items.filter((i) => i.value > 0);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {visible.map(({ icon: Icon, value, label }) => (
        <span key={label} className="inline-flex items-center gap-1" aria-label={`${value} ${label}`}>
          <Icon className="size-3.5" aria-hidden="true" /> {value}
        </span>
      ))}
    </div>
  );
}

function groupByWeek(items: EventRow[]): { weekStart: Date; items: EventRow[] }[] {
  const buckets = new Map<string, { weekStart: Date; items: EventRow[] }>();
  for (const item of items) {
    if (!item.startsAt) continue;
    const d = new Date(item.startsAt);
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString();
    if (!buckets.has(key)) buckets.set(key, { weekStart: monday, items: [] });
    buckets.get(key)!.items.push(item);
  }
  return [...buckets.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

function shortUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}
