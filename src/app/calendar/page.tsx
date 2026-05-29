import Link from 'next/link';
import { and, asc, gte, lte, or, isNull, eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db, ensureMigrated } from '@/lib/db/client';
import { events, resaleListings, seriesSubscriptions } from '@/lib/db/schema';
import { getReactionTallies } from '@/lib/discovery/reactions';
import { dedupeEvents } from '@/lib/discovery/dedupe';
import { readAnonId } from '@/lib/anon/identity';
import { WelcomeCard } from './welcome-card';
import { NotifyMeButton } from '@/components/notify-me-button';
import { ConnectRow } from './connect-row';
import { ClientFilter } from './client-filter';
import { filterEvents } from './filter-events';
import { cookies } from 'next/headers';
import type { ClientEvent } from './client-filter';

export const dynamic = 'force-dynamic';

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

  // Fetch ALL upcoming events in the 90-day window without text/venue/price
  // DB filters. Client-side filtering (via filterEvents) handles those.
  // DB still enforces date range and ownership so we don't ship private rows.
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

  // TBD events (no date yet).
  const tbd = await db
    .select()
    .from(events)
    .where(
      and(
        ownershipFilter,
        isNull(events.startsAt),
      )!,
    );

  // Same real-world gig sometimes shows up under multiple source URLs.
  // Collapse to one card per gig.
  const allShown = dedupeEvents([...upcoming, ...tbd]);
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

  // Distinct venues for the dropdown (from all events, not filtered).
  const distinctVenues = [...new Set(
    allShown
      .map((e) => e.venue)
      .filter((v): v is string => v != null && v.length > 0)
  )].sort();

  // Server-side filter for SSR output (SEO + fast cold load).
  // The client will use the same filterEvents function for subsequent
  // client-side filter changes, keeping behavior identical.
  const filterState = {
    q: filterQ,
    venue: filterVenue,
    from: filterFrom,
    to: filterTo,
    priceMax: filterPriceMax,
  };
  const serverFiltered = filterEvents(allShown, filterState);
  const totalEvents = serverFiltered.length;

  // Build serializable client event list and tallies map.
  // Dates must be serialized as ISO strings to cross the server/client boundary.
  const clientEvents: ClientEvent[] = allShown.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    venue: e.venue,
    ticketUrl: e.ticketUrl,
    seriesName: e.seriesName,
    ownerUserId: e.ownerUserId,
    anonOwnerId: e.anonOwnerId,
    priceLow: e.priceLow,
    priceHigh: e.priceHigh,
    city: e.city,
    metadata: e.metadata,
    // Dates cross server/client boundary as Date objects (Next.js serializes them).
    startsAt: e.startsAt,
    onSaleAt: e.onSaleAt,
  }));

  const talliesRecord = Object.fromEntries(tallies.entries());
  const resaleRecord = Object.fromEntries(resaleCounts.entries());

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

        {/* ClientFilter owns the filter UI + filtered event list. */}
        <ClientFilter
          initialEvents={clientEvents}
          tallies={talliesRecord}
          resaleCounts={resaleRecord}
          followedSeries={[...followedSeries]}
          venues={distinctVenues}
          initialFilter={filterState}
          totalServerCount={allShown.length}
        />
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
