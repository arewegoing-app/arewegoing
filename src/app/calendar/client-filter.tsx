'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { filterEvents, type FilterState, type FilterableEvent } from './filter-events';
import { EventCardExpander } from './event-card-expander';

/** Input style matching the existing filter-bar look. */
const inputStyle = {
  borderColor: 'var(--ed-line)',
  borderRadius: 0,
  fontFamily: 'var(--font-jbmono)',
  fontSize: '0.875rem',
  background: 'var(--ed-bg)',
  color: 'var(--ed-fg)',
  minHeight: '44px',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box' as const,
};

/** Full event shape passed from the server, matching EventRow from page.tsx. */
export type ClientEvent = FilterableEvent & {
  slug: string;
  ticketUrl: string | null;
  seriesName: string | null;
  ownerUserId: string | null;
  anonOwnerId: string | null;
  priceLow: number | null;
  priceHigh: number | null;
};

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

type ClientFilterProps = {
  /** All events fetched by the server (server-side pre-filtered). */
  initialEvents: ClientEvent[];
  /** All event tallies. */
  tallies: Record<string, Tally>;
  /** Resale listing counts per event. */
  resaleCounts: Record<string, number>;
  /** Series the viewer follows. */
  followedSeries: string[];
  /** Distinct venue names for the dropdown. */
  venues: string[];
  /** Current filter state (from searchParams). */
  initialFilter: FilterState;
  /** Total count as counted on the server for the header. */
  totalServerCount: number;
};

/**
 * ClientFilter owns the filter controls and the filtered event list.
 * It updates URL search params via router.replace (no scroll, no reload)
 * and re-filters the in-memory event list using filterEvents.
 */
export function ClientFilter({
  initialEvents,
  tallies,
  resaleCounts,
  followedSeries,
  venues,
  initialFilter,
  totalServerCount,
}: ClientFilterProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Filter state — initialized from the server-provided initialFilter prop.
  // This avoids useSearchParams (which needs a Suspense boundary) while still
  // being SSR-consistent: the server passes current params as initialFilter.
  const [filter, setFilter] = useState<FilterState>({
    q: initialFilter.q ?? '',
    venue: initialFilter.venue ?? '',
    from: initialFilter.from ?? '',
    to: initialFilter.to ?? '',
    priceMax: initialFilter.priceMax,
  });

  // Expanded card state — only one card open at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce ref for text search.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Push current filter state to the URL without scroll-reset. */
  const syncUrl = useCallback(
    (next: FilterState) => {
      const params = new URLSearchParams();
      if (next.q) params.set('q', next.q);
      if (next.venue) params.set('venue', next.venue);
      if (next.from) params.set('from', next.from);
      if (next.to) params.set('to', next.to);
      if (next.priceMax !== undefined && next.priceMax !== null) {
        params.set('priceMax', String(next.priceMax));
      }
      const qs = params.toString();
      const url = qs ? `/calendar?${qs}` : '/calendar';
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    },
    [router],
  );

  /** Update a single filter key and sync to URL. */
  const updateFilter = useCallback(
    (key: keyof FilterState, value: string | number | undefined) => {
      const next: FilterState = { ...filter, [key]: value || undefined };
      // For text search: debounce URL push but filter immediately.
      if (key === 'q') {
        setFilter(next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => syncUrl(next), 300);
      } else {
        setFilter(next);
        syncUrl(next);
      }
    },
    [filter, syncUrl],
  );

  /** Filtered event list — memoized so we don't re-filter inside render. */
  const filtered = useMemo(() => {
    return filterEvents(initialEvents, {
      q: filter.q,
      venue: filter.venue,
      from: filter.from,
      to: filter.to,
      priceMax: filter.priceMax,
    });
  }, [initialEvents, filter]);

  const hasFilters = !!(filter.q || filter.venue || filter.from || filter.to || filter.priceMax);

  return (
    <>
      {/* Filter controls */}
      <section className="ed-card p-4 sm:p-5" aria-label="Filter events">
        <div className="u-mono opacity-50 mb-3">[04] / Filter</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* [01] Free-text search */}
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-2">
            <label htmlFor="client-filter-q" className="u-mono flex items-center gap-2 opacity-70">
              <span className="opacity-60">[01]</span>
              <span>Search</span>
            </label>
            <input
              id="client-filter-q"
              type="search"
              role="searchbox"
              placeholder="Artist, event name, venue…"
              value={filter.q ?? ''}
              className="w-full border px-3 py-3"
              style={inputStyle}
              aria-label="Search events by title or venue"
              onChange={(e) => updateFilter('q', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  updateFilter('q', '');
                }
              }}
            />
          </div>

          {/* [02] Venue */}
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="client-filter-venue" className="u-mono flex items-center gap-2 opacity-70">
              <span className="opacity-60">[02]</span>
              <span>Venue</span>
            </label>
            <select
              id="client-filter-venue"
              value={filter.venue ?? ''}
              className="w-full border px-3 py-3"
              style={{ ...inputStyle, appearance: 'none' as const }}
              aria-label="Filter by venue"
              onChange={(e) => updateFilter('venue', e.target.value)}
            >
              <option value="">All venues</option>
              {venues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* [03] From date */}
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="client-filter-from" className="u-mono flex items-center gap-2 opacity-70">
              <span className="opacity-60">[03]</span>
              <span>From</span>
            </label>
            <input
              id="client-filter-from"
              type="date"
              value={filter.from ?? ''}
              className="w-full border px-3 py-3"
              style={inputStyle}
              aria-label="Filter events starting from date"
              onChange={(e) => updateFilter('from', e.target.value)}
            />
          </div>

          {/* [04] To date */}
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="client-filter-to" className="u-mono flex items-center gap-2 opacity-70">
              <span className="opacity-60">[04]</span>
              <span>To</span>
            </label>
            <input
              id="client-filter-to"
              type="date"
              value={filter.to ?? ''}
              className="w-full border px-3 py-3"
              style={inputStyle}
              aria-label="Filter events ending by date"
              onChange={(e) => updateFilter('to', e.target.value)}
            />
          </div>

          {/* [05] Max price */}
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="client-filter-price" className="u-mono flex items-center gap-2 opacity-70">
              <span className="opacity-60">[05]</span>
              <span>Max price (NZD)</span>
            </label>
            <input
              id="client-filter-price"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              placeholder="e.g. 50"
              value={filter.priceMax ?? ''}
              className="w-full border px-3 py-3"
              style={inputStyle}
              aria-label="Maximum ticket price in NZD"
              onChange={(e) =>
                updateFilter('priceMax', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            {hasFilters && (
              <button
                type="button"
                className="ed-chip"
                aria-label="Clear all filters"
                onClick={() => {
                  const cleared: FilterState = {};
                  setFilter(cleared);
                  syncUrl(cleared);
                }}
              >
                ↳ Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filtered event count */}
      {hasFilters && (
        <div className="u-mono opacity-60 text-sm">
          {filtered.length} of {totalServerCount} events match
        </div>
      )}

      {/* Event list rendered by client after filtering */}
      <ClientEventList
        events={filtered}
        tallies={tallies}
        resaleCounts={resaleCounts}
        followedSeries={new Set(followedSeries)}
        expandedId={expandedId}
        onToggleExpand={(id) =>
          setExpandedId((prev) => (prev === id ? null : id))
        }
        hasFilters={hasFilters}
      />
    </>
  );
}

/** Renders the grouped week sections + TBD bucket, consuming the already-filtered list. */
function ClientEventList({
  events,
  tallies,
  resaleCounts,
  followedSeries,
  expandedId,
  onToggleExpand,
  hasFilters,
}: {
  events: ClientEvent[];
  tallies: Record<string, Tally>;
  resaleCounts: Record<string, number>;
  followedSeries: Set<string>;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  hasFilters: boolean;
}) {
  const dated = events.filter((e) => e.startsAt !== null);
  const tbd = events.filter((e) => e.startsAt === null);
  const totalEvents = events.length;
  const eventNumPadding = String(totalEvents).length;
  const grouped = groupByWeek(dated);

  if (totalEvents === 0 && hasFilters) {
    return (
      <div className="ed-card py-16 text-center">
        <h3 className="u-display text-2xl">No matches.</h3>
        <p className="u-mono mt-2 opacity-60">Try adjusting or clearing your filters.</p>
        <button
          type="button"
          className="ed-chip mt-6 inline-flex"
          onClick={() => {
            /* Trigger clear via the parent; for now just reload clean URL */
            window.location.href = '/calendar';
          }}
        >
          ↳ Clear filters
        </button>
      </div>
    );
  }

  if (totalEvents === 0) {
    return (
      <div className="ed-card py-16 text-center">
        <h3 className="u-display text-2xl">Nothing yet.</h3>
        <p className="u-mono mt-2 opacity-60">Ingest hasn&apos;t pulled anything fresh.</p>
      </div>
    );
  }

  return (
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
              <EventCardExpander
                key={e.id}
                event={e}
                tally={tallies[e.id]}
                resaleCount={resaleCounts[e.id] ?? 0}
                isFollowingSeries={e.seriesName ? followedSeries.has(e.seriesName) : false}
                indexLabel={String(gi * 100 + i + 1).padStart(eventNumPadding, '0')}
                isExpanded={expandedId === e.id}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </ul>
        </section>
      ))}

      {tbd.length > 0 && (
        <section aria-label="Events with no fixed date yet">
          <div className="mb-3 flex items-baseline justify-between border-b border-[color:var(--ed-line)] pb-1">
            <h3 className="u-mono opacity-60">↳ Date TBD</h3>
            <span className="u-mono opacity-40">
              {String(tbd.length).padStart(2, '0')}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-px bg-[color:var(--ed-line)] border border-[color:var(--ed-line)] sm:grid-cols-2">
            {tbd.map((e, i) => (
              <EventCardExpander
                key={e.id}
                event={e}
                tally={tallies[e.id]}
                resaleCount={resaleCounts[e.id] ?? 0}
                isFollowingSeries={e.seriesName ? followedSeries.has(e.seriesName) : false}
                indexLabel={`T·${String(i + 1).padStart(2, '0')}`}
                isExpanded={expandedId === e.id}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function groupByWeek(
  items: ClientEvent[],
): { weekStart: Date; items: ClientEvent[] }[] {
  const buckets = new Map<string, { weekStart: Date; items: ClientEvent[] }>();
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
  return [...buckets.values()].sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime(),
  );
}
