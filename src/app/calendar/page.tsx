import Link from 'next/link';
import { and, asc, gte, lte, or, isNull, eq, sql, ilike } from 'drizzle-orm';
import { CheckCircle2Icon, EyeIcon, TicketIcon, TicketCheckIcon, XCircleIcon } from 'lucide-react';
import { auth } from '@/lib/auth/auth';
import { db, ensureMigrated } from '@/lib/db/client';
import { events, resaleListings, seriesSubscriptions } from '@/lib/db/schema';
import { getReactionTallies } from '@/lib/discovery/reactions';
import { dedupeEvents } from '@/lib/discovery/dedupe';
import { readAnonId } from '@/lib/anon/identity';
import { withRef } from '@/lib/outbound/with-ref';
import { CalendarReactions } from './reactions-row';
import { ClaimForm } from './claim-form';
import { WelcomeCard } from './welcome-card';
import { SeriesFollowButton } from './series-follow';
import { NotifyMeButton } from '@/components/notify-me-button';
import { FilterBar } from './filter-bar';
import { ConnectRow } from './connect-row';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

type EventRow = typeof events.$inferSelect;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    reaction?: string;
    event?: string;
    q?: string;
    venue?: string;
    from?: string;
    to?: string;
    priceMax?: string;
  }>;
}) {
  await ensureMigrated();
  const session = await auth();
  const signedIn = !!session?.user?.id;
  const sp = await searchParams;
  const cookieStore = await cookies();
  const welcomeDismissed = cookieStore.get('gigs_welcome_dismissed')?.value === '1';
  const anonId = await readAnonId();

  // Extract filter params.
  const filterQ = sp.q?.trim() || undefined;
  const filterVenue = sp.venue?.trim() || undefined;
  const filterFrom = sp.from?.trim() || undefined;
  const filterTo = sp.to?.trim() || undefined;
  const filterPriceMax = sp.priceMax?.trim() ? Number(sp.priceMax) : undefined;
  const hasFilters = !!(filterQ || filterVenue || filterFrom || filterTo || filterPriceMax != null);

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

  // Build optional filter conditions.
  const fromDate = filterFrom ? new Date(filterFrom) : undefined;
  // End-of-day for the `to` filter.
  const toDate = filterTo
    ? (() => {
        const d = new Date(filterTo);
        d.setHours(23, 59, 59, 999);
        return d;
      })()
    : undefined;

  const searchFilter =
    filterQ != null
      ? or(
          ilike(events.title, `%${filterQ}%`),
          ilike(events.venue, `%${filterQ}%`),
        )
      : undefined;
  const venueFilter = filterVenue != null ? eq(events.venue, filterVenue) : undefined;
  const priceFilter =
    filterPriceMax != null ? lte(events.priceLow, filterPriceMax) : undefined;

  // Two passes: events with a real date in the next 90 days, plus TBD events
  // (live ingest hasn't resolved a date yet). TBD events show in their own
  // bucket at the bottom so they don't disappear from the calendar.
  // When date filters are active, suppress the TBD bucket.
  const upcoming = await db
    .select()
    .from(events)
    .where(
      and(
        ownershipFilter,
        gte(events.startsAt, fromDate ?? now),
        lte(events.startsAt, toDate ?? ninetyDaysOut),
        searchFilter,
        venueFilter,
        priceFilter,
      )!,
    )
    .orderBy(asc(events.startsAt));

  // TBD events are only shown when no date-range filter is active.
  const tbd =
    filterFrom || filterTo
      ? []
      : await db
          .select()
          .from(events)
          .where(
            and(
              ownershipFilter,
              isNull(events.startsAt),
              searchFilter,
              venueFilter,
              priceFilter,
            )!,
          );

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

  // Distinct venues — computed WITHOUT the venue filter so the dropdown always
  // shows all options regardless of what's selected.
  const venueRows = await db
    .selectDistinct({ venue: events.venue })
    .from(events)
    .where(
      and(
        ownershipFilter,
        gte(events.startsAt, fromDate ?? now),
        lte(events.startsAt, toDate ?? ninetyDaysOut),
        searchFilter,
        priceFilter,
      )!,
    )
    .orderBy(asc(events.venue));
  const distinctVenues = venueRows
    .map((r) => r.venue)
    .filter((v): v is string => v != null && v.length > 0);

  const grouped = groupByWeek(dedupedUpcoming);

  const totalEvents = dedupedUpcoming.length + dedupedTbd.length;
  const eventNumPadding = String(totalEvents).length;

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero — Form Follows Friction style, but built around the gig calendar. */}
      <section className="pt-4 pb-2">
        <div className="grid grid-cols-2 gap-4 pb-4 sm:gap-6">
          <div className="u-mono leading-relaxed" style={{ color: 'var(--ed-fg-soft)' }}>
            <span className="block opacity-50">[01]</span>
            <strong className="block font-medium">Wellington · NZ</strong>
            <span className="block">Live ingest from UTR · Humanitix · Moshtix</span>
          </div>
          <div className="u-mono leading-relaxed" style={{ color: 'var(--ed-fg-soft)' }}>
            <span className="block opacity-50">[02]</span>
            <strong className="block font-medium">Next 90 days</strong>
            <span className="block">{totalEvents.toString().padStart(2, '0')} events tracked</span>
          </div>
        </div>

        <h1
          className="u-display"
          style={{ fontSize: 'clamp(3rem, 14vw, 9rem)', lineHeight: 0.85 }}
        >
          Are<sup className="u-mono align-top" style={{ fontSize: '0.18em', marginLeft: '0.2em' }}>
            (01)
          </sup>
          <br />
          we{' '}
          <em className="not-italic u-accent-bg">going</em>
          <span style={{ color: 'var(--ed-accent-2)' }}>?</span>
        </h1>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-[2fr_1fr] sm:items-end sm:gap-6">
          <p className="max-w-prose text-base leading-snug sm:text-lg">
            A shared calendar for Wellington gigs. No signin to react. Tap{' '}
            <em className="not-italic u-accent-bg">I&apos;m down</em> and once three of you
            agree, anyone can claim the gig and run the group buy.
          </p>
          {signedIn ? (
            <Link href="/new" className="ed-chip justify-self-start sm:justify-self-end">
              + New event <span aria-hidden>↗</span>
            </Link>
          ) : (
            <Link href="/signin" className="ed-chip justify-self-start sm:justify-self-end">
              Sign in <span aria-hidden>↗</span>
            </Link>
          )}
        </div>
      </section>

      {/* Looped marquee — visual break + restates the value prop. */}
      <div className="ed-marquee -mx-4 sm:-mx-6" aria-hidden="true">
        <div className="ed-marquee__track">
          <span>Live Music Wellington</span>
          <span className="dot">●</span>
          <span>Group Buying</span>
          <span className="dot">●</span>
          <span>No Bail Risk</span>
          <span className="dot">●</span>
          <span>3 Friends = Rally</span>
          <span className="dot">●</span>
          <span>Live Music Wellington</span>
          <span className="dot">●</span>
          <span>Group Buying</span>
          <span className="dot">●</span>
          <span>No Bail Risk</span>
          <span className="dot">●</span>
          <span>3 Friends = Rally</span>
          <span className="dot">●</span>
        </div>
      </div>

      <WelcomeCard dismissed={welcomeDismissed} />

      <FilterBar
        venues={distinctVenues}
        current={{
          q: filterQ,
          venue: filterVenue,
          from: filterFrom,
          to: filterTo,
          priceMax: sp.priceMax?.trim() || undefined,
        }}
      />

      {sp.reaction && (
        <div
          role="status"
          className="border px-4 py-2"
          style={{
            background: 'var(--ed-accent)',
            color: 'var(--ed-fg)',
            borderColor: 'var(--ed-line)',
          }}
        >
          <span className="u-mono opacity-60">↳ Recorded</span>{' '}
          <strong>{sp.reaction}</strong>
          {sp.event ? ` on ${sp.event}` : ''}
        </div>
      )}

      {/* Section head — `[03] / Index · TITLE · NN ITEMS` */}
      <section aria-label="Next 90 days">
        <div className="ed-section-head">
          <div className="u-mono opacity-50">[03] / Index</div>
          <h2
            className="u-display"
            style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', margin: 0 }}
          >
            Next 90 days{' '}
            <span style={{ color: 'var(--ed-fg-soft)' }}>2026</span>
          </h2>
          <div className="u-mono opacity-50">
            {String(totalEvents).padStart(2, '0')} items
            {hasFilters && (
              <span className="ml-2 opacity-60">(filtered)</span>
            )}
          </div>
        </div>

        {totalEvents === 0 && hasFilters ? (
          <div className="ed-card py-16 text-center">
            <h3 className="u-display text-2xl">No matches.</h3>
            <p className="u-mono mt-2 opacity-60">
              Try adjusting or clearing your filters.
            </p>
            <Link href="/calendar" className="ed-chip mt-6 inline-flex">
              ↳ Clear filters
            </Link>
          </div>
        ) : totalEvents === 0 ? (
          <div className="ed-card py-16 text-center">
            <h3 className="u-display text-2xl">Nothing yet.</h3>
            <p className="u-mono mt-2 opacity-60">
              Ingest hasn&apos;t pulled anything fresh.
            </p>
            {signedIn && (
              <Link href="/new" className="ed-chip mt-6 inline-flex">
                + Add an event
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-10">
            {grouped.map(({ weekStart, items }, gi) => (
              <section
                key={weekStart.toISOString()}
                aria-label={`Week of ${weekStart.toDateString()}`}
              >
                <div className="mb-3 flex items-baseline justify-between border-b border-[color:var(--ed-line)] pb-1">
                  <h3 className="u-mono opacity-60">
                    ↳ Week of{' '}
                    {weekStart.toLocaleDateString('en-NZ', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'Pacific/Auckland',
                    })}
                  </h3>
                  <span className="u-mono opacity-40">
                    {String(items.length).padStart(2, '0')}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-px bg-[color:var(--ed-line)] border border-[color:var(--ed-line)] sm:grid-cols-2">
                  {items.map((e, i) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      tally={tallies.get(e.id)}
                      resaleCount={resaleCounts.get(e.id) ?? 0}
                      isFollowingSeries={e.seriesName ? followedSeries.has(e.seriesName) : false}
                      indexLabel={String(gi * 100 + i + 1).padStart(eventNumPadding, '0')}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {dedupedTbd.length > 0 && (
              <section aria-label="Events with no fixed date yet">
                <div className="mb-3 flex items-baseline justify-between border-b border-[color:var(--ed-line)] pb-1">
                  <h3 className="u-mono opacity-60">↳ Date TBD</h3>
                  <span className="u-mono opacity-40">
                    {String(dedupedTbd.length).padStart(2, '0')}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-px bg-[color:var(--ed-line)] border border-[color:var(--ed-line)] sm:grid-cols-2">
                  {dedupedTbd.map((e, i) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      tally={tallies.get(e.id)}
                      resaleCount={resaleCounts.get(e.id) ?? 0}
                      isFollowingSeries={e.seriesName ? followedSeries.has(e.seriesName) : false}
                      indexLabel={`T·${String(i + 1).padStart(2, '0')}`}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </section>

      {/* Connect section — slice 7 mock shells. */}
      <section aria-label="Connect your accounts">
        <div className="ed-section-head">
          <div className="u-mono opacity-50">[04] / Connect</div>
          <h2
            className="u-display"
            style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', margin: 0 }}
          >
            Plug it in.
          </h2>
          <div className="u-mono opacity-50">04 ready</div>
        </div>
        <div className="mt-4">
          <ConnectRow />
        </div>
      </section>

      {/* Notify-me strip — slice 3 wiring demo. */}
      <section
        className="ed-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div>
          <div className="u-mono opacity-50">[05] / Heads up</div>
          <h2 className="u-display mt-1 text-2xl">
            Ping me when{' '}
            <em className="not-italic u-accent-bg">new things</em> ship.
          </h2>
        </div>
        <NotifyMeButton featureKey="general.new_features" label="Notify me" />
      </section>

      {/* Footer ledger */}
      <footer className="border-t border-[color:var(--ed-line)] pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <div className="u-mono opacity-50">↳ Sources</div>
            <ul className="u-mono mt-1 space-y-1">
              <li>
                <a
                  href="https://www.undertheradar.co.nz/whatson/wellington"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[color:var(--ed-accent-2)]"
                >
                  ↳ Under the Radar
                </a>
              </li>
              <li>
                <a
                  href="https://events.humanitix.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[color:var(--ed-accent-2)]"
                >
                  ↳ Humanitix
                </a>
              </li>
              <li>
                <a
                  href="https://www.moshtix.co.nz"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[color:var(--ed-accent-2)]"
                >
                  ↳ Moshtix
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="u-mono opacity-50">↳ Colophon</div>
            <ul className="u-mono mt-1 space-y-1">
              <li>Archivo + JetBrains Mono</li>
              <li>OKLCH color space</li>
              <li>Hand-rolled Next.js 16</li>
              <li>No tracking</li>
            </ul>
          </div>
          <div>
            <div className="u-mono opacity-50">↳ Tip</div>
            <p className="u-mono mt-1 opacity-70 leading-relaxed">
              Tap an unclaimed gig&apos;s title to view tickets. Spotted a wrong date? Open the
              event and hit &quot;Refresh from source&quot;.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

type Tally = {
  interested: number;
  down: number;
  cant: number;
  pledge_1: number;
  pledge_2: number;
  have_ticket: number;
  extras: number;
  need_ticket: number;
};

const ZERO_TALLY: Tally = {
  interested: 0,
  down: 0,
  cant: 0,
  pledge_1: 0,
  pledge_2: 0,
  have_ticket: 0,
  extras: 0,
  need_ticket: 0,
};

function EventCard({
  event,
  tally,
  resaleCount,
  isFollowingSeries,
  indexLabel,
}: {
  event: EventRow;
  tally: Tally | undefined;
  resaleCount: number;
  isFollowingSeries: boolean;
  indexLabel: string;
}) {
  const t = tally ?? ZERO_TALLY;
  const downCount = t.down + t.pledge_1 + t.pledge_2 + t.have_ticket;
  const unclaimed = !event.ownerUserId && !event.anonOwnerId;
  const readyToRally = downCount >= 3 && unclaimed;

  const dateStr = event.startsAt
    ? new Date(event.startsAt).toLocaleString('en-NZ', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Pacific/Auckland',
      })
    : 'TBD';

  return (
    <li
      className="ed-card flex flex-col"
      style={{ border: '0' }}
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {/* Meta row — numbered index, date, price band */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="ed-card__num">FIG·{indexLabel}</span>
          <span className="u-mono" style={{ color: 'var(--ed-fg-soft)' }}>
            {dateStr}
            {event.priceLow ? ` · $${event.priceLow}` : ''}
          </span>
        </div>

        {/* Title */}
        <h3
          className="u-display"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', margin: 0 }}
        >
          {!unclaimed ? (
            <Link
              href={`/e/${event.slug}`}
              className="hover:underline"
              style={{ textDecorationThickness: '2px' }}
            >
              {event.title}
            </Link>
          ) : event.ticketUrl ? (
            <a
              href={withRef(event.ticketUrl)}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ textDecorationThickness: '2px' }}
              aria-label={`${event.title} — view tickets (opens in new tab)`}
            >
              {event.title}
            </a>
          ) : (
            event.title
          )}
        </h3>

        {/* Venue */}
        <div className="u-mono leading-snug" style={{ color: 'var(--ed-fg-soft)' }}>
          <span aria-hidden>▪ </span>
          {event.venue ?? 'Venue TBA'}
        </div>

        {/* Badges row */}
        {(event.seriesName || resaleCount > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {event.seriesName && (
              <>
                <span
                  className="u-mono"
                  style={{
                    background: 'var(--ed-fg)',
                    color: 'var(--ed-bg)',
                    padding: '0.25rem 0.5rem',
                  }}
                >
                  {event.seriesName}
                </span>
                <SeriesFollowButton
                  seriesName={event.seriesName}
                  initialSubscribed={isFollowingSeries}
                />
              </>
            )}
            {resaleCount > 0 && (
              <span
                className="u-mono"
                style={{
                  background: 'var(--ed-accent)',
                  color: 'var(--ed-fg)',
                  padding: '0.25rem 0.5rem',
                  border: '1px solid var(--ed-line)',
                }}
              >
                ▸ {resaleCount} resale {resaleCount === 1 ? 'ticket' : 'tickets'}
              </span>
            )}
          </div>
        )}

        {/* Live tally — only shown when non-empty */}
        <ReactionTally tally={t} />

        {/* Ticket source link */}
        {event.ticketUrl && (
          <a
            href={withRef(event.ticketUrl)}
            target="_blank"
            rel="noreferrer"
            className="u-mono inline-flex items-center gap-1 self-start hover:text-[color:var(--ed-accent-2)]"
            style={{ color: 'var(--ed-fg-soft)' }}
          >
            ↳ {shortUrl(event.ticketUrl)} <span aria-hidden>↗</span>
          </a>
        )}
      </div>

      {/* Reaction row — separator-as-border, full bleed */}
      <div className="border-t border-[color:var(--ed-line)] p-4 sm:p-5">
        <CalendarReactions eventId={event.id} />
      </div>

      {/* Rally CTA — only when 3+ are down and unclaimed */}
      {readyToRally && (
        <div className="border-t border-[color:var(--ed-line)] p-4 sm:p-5"
          style={{ background: 'var(--ed-accent)' }}
        >
          <div className="u-mono mb-2">
            ↳ {downCount} friends down — rally now
          </div>
          <ClaimForm eventId={event.id} eventTitle={event.title} />
        </div>
      )}
    </li>
  );
}

function ReactionTally({ tally }: { tally: Tally }) {
  const items: Array<{ icon: typeof EyeIcon; value: number; label: string; accent?: boolean }> = [
    { icon: EyeIcon, value: tally.interested, label: 'interested' },
    { icon: CheckCircle2Icon, value: tally.down, label: 'down', accent: true },
    { icon: TicketIcon, value: tally.pledge_1 + tally.pledge_2, label: 'pledging' },
    { icon: TicketCheckIcon, value: tally.have_ticket, label: 'have ticket' },
    { icon: TicketCheckIcon, value: tally.extras, label: 'extras', accent: true },
    { icon: TicketCheckIcon, value: tally.need_ticket, label: 'need one', accent: true },
    { icon: XCircleIcon, value: tally.cant, label: "can't" },
  ];
  const visible = items.filter((i) => i.value > 0);
  if (visible.length === 0) return null;
  return (
    <div className="u-mono flex flex-wrap items-center gap-3" style={{ color: 'var(--ed-fg-soft)' }}>
      {visible.map(({ icon: Icon, value, label, accent }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1"
          aria-label={`${value} ${label}`}
          style={accent ? { color: 'var(--ed-fg)' } : undefined}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{String(value).padStart(2, '0')}</span>
          <span className="opacity-60">{label}</span>
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
