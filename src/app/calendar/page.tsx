import Link from 'next/link';
import { and, asc, gte, lte, or, isNull, eq, sql } from 'drizzle-orm';
import { CheckCircle2Icon, EyeIcon, PlusIcon, TicketIcon, TicketCheckIcon, XCircleIcon } from 'lucide-react';
import { auth } from '@/lib/auth/auth';
import { db, ensureMigrated } from '@/lib/db/client';
import { events, resaleListings, seriesSubscriptions } from '@/lib/db/schema';
import { getReactionTallies } from '@/lib/discovery/reactions';
import { dedupeEvents } from '@/lib/discovery/dedupe';
import { readAnonId } from '@/lib/anon/identity';
import { CalendarReactions } from './reactions-row';
import { ClaimForm } from './claim-form';
import { WelcomeCard } from './welcome-card';
import { SeriesFollowButton } from './series-follow';
import { cookies } from 'next/headers';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type EventRow = typeof events.$inferSelect;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ reaction?: string; event?: string }>;
}) {
  await ensureMigrated();
  const session = await auth();
  const signedIn = !!session?.user?.id;
  const sp = await searchParams;
  const cookieStore = await cookies();
  const welcomeDismissed = cookieStore.get('gigs_welcome_dismissed')?.value === '1';
  const anonId = await readAnonId();

  // Load this viewer's series subscriptions once so each card knows whether to
  // show "Follow" or "Following".
  const followedSeries = new Set<string>();
  if (signedIn || anonId) {
    const rows = await db
      .select({ name: seriesSubscriptions.seriesName })
      .from(seriesSubscriptions)
      .where(
        signedIn
          ? eq(seriesSubscriptions.userId, session!.user!.id)
          : eq(seriesSubscriptions.anonId, anonId!),
      );
    for (const r of rows) followedSeries.add(r.name);
  }

  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Public surface: anyone can see discovered events (no owner) + their own
  // events if signed in. Owned events created by other people stay private.
  const ownershipFilter = signedIn
    ? or(isNull(events.ownerUserId), eq(events.ownerUserId, session!.user!.id))!
    : isNull(events.ownerUserId);

  // Two passes: events with a real date in the next 90 days, plus TBD events
  // (live ingest hasn't resolved a date yet). TBD events show in their own
  // bucket at the bottom so they don't disappear from the calendar.
  const upcoming = await db
    .select()
    .from(events)
    .where(
      and(
        ownershipFilter,
        gte(events.startsAt, now),
        lte(events.startsAt, ninetyDaysOut),
      )!,
    )
    .orderBy(asc(events.startsAt));

  const tbd = await db
    .select()
    .from(events)
    .where(and(ownershipFilter, isNull(events.startsAt))!);


  // Same real-world gig sometimes shows up under multiple source URLs
  // (Humanitix + Under the Radar). Collapse to one card per gig.
  const allShown = dedupeEvents([...upcoming, ...tbd]);
  const dedupedUpcoming = allShown.filter((e) => e.startsAt !== null);
  const dedupedTbd = allShown.filter((e) => e.startsAt === null);
  const tallies = await getReactionTallies(allShown.map((e) => e.id));

  // Count active resale listings per event in one query.
  const eventIds = allShown.map((e) => e.id);
  const resaleCounts = new Map<string, number>();
  if (eventIds.length > 0) {
    const rows = await db
      .select({ eventId: resaleListings.eventId, count: sql<number>`count(*)::int` })
      .from(resaleListings)
      .where(sql`${resaleListings.state} = 'open' and ${resaleListings.eventId} in ${eventIds}`)
      .groupBy(resaleListings.eventId);
    for (const r of rows) resaleCounts.set(r.eventId, Number(r.count));
  }

  const grouped = groupByWeek(dedupedUpcoming);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Next 90 days</h1>
          <p className="text-sm text-muted-foreground">
            Wellington gigs pulled from Humanitix, Moshtix, and Under the Radar.
          </p>
        </div>
        {signedIn && (
          <Link href="/new" className={cn(buttonVariants())}>
            <PlusIcon aria-hidden="true" /> New event
          </Link>
        )}
      </header>

      <WelcomeCard dismissed={welcomeDismissed} />

      {sp.reaction && (
        <div
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          Reaction recorded: <strong>{sp.reaction}</strong>
          {sp.event ? ` on ${sp.event}` : ''}
        </div>
      )}

      {dedupedUpcoming.length === 0 && dedupedTbd.length === 0 && (
        <Card>
          <CardContent className="mx-auto max-w-md py-12 text-center">
            <h2 className="text-base font-medium">No gigs in the next 90 days</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The ingest job hasn&apos;t pulled anything fresh yet. Check back in a few hours, or
              add one yourself.
            </p>
            {signedIn && (
              <Link href="/new" className={cn(buttonVariants(), 'mt-4')}>
                <PlusIcon aria-hidden="true" /> Create an event
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {grouped.map(({ weekStart, items }) => (
          <section key={weekStart.toISOString()} aria-label={`Week of ${weekStart.toDateString()}`}>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Week of{' '}
              {weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'Pacific/Auckland' })}
            </h2>
            <ul className="space-y-3">
              {items.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  tally={tallies.get(e.id)}
                  resaleCount={resaleCounts.get(e.id) ?? 0}
                  isFollowingSeries={e.seriesName ? followedSeries.has(e.seriesName) : false}
                />
              ))}
            </ul>
          </section>
        ))}

        {dedupedTbd.length > 0 && (
          <section aria-label="Events with no fixed date yet">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Date TBD</h2>
            <ul className="space-y-3">
              {dedupedTbd.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  tally={tallies.get(e.id)}
                  resaleCount={resaleCounts.get(e.id) ?? 0}
                  isFollowingSeries={e.seriesName ? followedSeries.has(e.seriesName) : false}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Listings pulled from{' '}
        <a
          href="https://www.undertheradar.co.nz/whatson/wellington"
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline"
        >
          Under the Radar
        </a>
        ,{' '}
        <a
          href="https://events.humanitix.com"
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline"
        >
          Humanitix
        </a>
        , and{' '}
        <a
          href="https://www.moshtix.co.nz"
          target="_blank"
          rel="noreferrer"
          className="text-foreground hover:underline"
        >
          Moshtix
        </a>
        . Tap an unclaimed gig&apos;s title to view tickets. Spotted a wrong date? Open the event
        and hit &quot;Refresh from source&quot;.
      </footer>
    </div>
  );
}

function EventCard({
  event,
  tally,
  resaleCount,
  isFollowingSeries,
}: {
  event: EventRow;
  tally:
    | { interested: number; down: number; cant: number; pledge_1: number; pledge_2: number; have_ticket: number }
    | undefined;
  resaleCount: number;
  isFollowingSeries: boolean;
}) {
  const t = tally ?? { interested: 0, down: 0, cant: 0, pledge_1: 0, pledge_2: 0, have_ticket: 0 };
  const downCount = t.down + t.pledge_1 + t.pledge_2 + t.have_ticket;
  const unclaimed = !event.ownerUserId && !event.anonOwnerId;
  const readyToRally = downCount >= 3 && unclaimed;
  return (
    <li>
      <Card>
        <CardHeader className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-medium leading-tight">
                {!unclaimed ? (
                  <Link href={`/gigs/e/${event.slug}`} className="hover:underline">
                    {event.title}
                  </Link>
                ) : event.ticketUrl ? (
                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                    aria-label={`${event.title} — view tickets (opens in new tab)`}
                  >
                    {event.title}
                  </a>
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
                      timeZone: 'Pacific/Auckland',
                    })
                  : ' · TBD'}
                {event.priceLow ? ` · from $${event.priceLow}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {event.seriesName && (
                  <>
                    <Badge variant="secondary">{event.seriesName}</Badge>
                    <SeriesFollowButton seriesName={event.seriesName} initialSubscribed={isFollowingSeries} />
                  </>
                )}
                {resaleCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    🎟️ {resaleCount} resale {resaleCount === 1 ? 'ticket' : 'tickets'}
                  </Badge>
                )}
              </div>
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
            <ClaimForm eventId={event.id} eventTitle={event.title} />
          </CardFooter>
        )}
      </Card>
    </li>
  );
}

function ReactionTally({
  tally,
}: {
  tally: { interested: number; down: number; cant: number; pledge_1: number; pledge_2: number; have_ticket: number };
}) {
  const items: Array<{ icon: typeof EyeIcon; value: number; label: string }> = [
    { icon: EyeIcon, value: tally.interested, label: 'interested' },
    { icon: CheckCircle2Icon, value: tally.down, label: 'down' },
    { icon: TicketIcon, value: tally.pledge_1 + tally.pledge_2, label: 'pledging' },
    { icon: TicketCheckIcon, value: tally.have_ticket, label: 'have ticket' },
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
    void 0;
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
