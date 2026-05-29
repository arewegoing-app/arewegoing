/**
 * filterEvents — pure, synchronous client-side event filter.
 *
 * Used by both the server (SSR pass in page.tsx) and the client
 * (ClientFilter component) so filtered URLs render identically on cold load.
 *
 * Performance: designed for ≤5,000 events. Callers should wrap in useMemo.
 */

export type FilterState = {
  q?: string;
  venue?: string;
  from?: string;
  to?: string;
  priceMax?: number;
};

/** Minimal shape filterEvents cares about. Actual event rows are a superset. */
export type FilterableEvent = {
  id: string;
  title: string;
  venue: string | null;
  startsAt: Date | null;
  priceLow: number | null;
  priceHigh: number | null;
};

/**
 * Escape a string so it can be used as a literal pattern in RegExp.
 * Prevents query strings like `.+*?[]` from crashing the filter.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize text for accent-folded case-insensitive comparison.
 * Converts 'Ré' → 're', 'Ü' → 'u', etc.
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function filterEvents<T extends FilterableEvent>(
  events: T[],
  state: FilterState,
): T[] {
  const q = state.q?.trim();
  const venue = state.venue?.trim();
  const priceMax = state.priceMax;

  const fromDate = state.from ? new Date(state.from) : undefined;
  // End-of-day for the `to` filter.
  const toDate = state.to
    ? (() => {
        const d = new Date(state.to!);
        d.setHours(23, 59, 59, 999);
        return d;
      })()
    : undefined;

  const hasDateFilter = !!(fromDate || toDate);

  // Build a regex once rather than per-event.
  let searchRe: RegExp | undefined;
  if (q) {
    searchRe = new RegExp(escapeRegex(normalize(q)));
  }

  return events.filter((e) => {
    // Date filter: if any date filter is active, null startsAt is excluded.
    if (hasDateFilter) {
      if (e.startsAt === null) return false;
      const t = e.startsAt instanceof Date ? e.startsAt : new Date(e.startsAt);
      if (fromDate && t < fromDate) return false;
      if (toDate && t > toDate) return false;
    }

    // Exact venue match.
    if (venue) {
      if (e.venue !== venue) return false;
    }

    // Price filter: effective price is priceLow ?? priceHigh ?? 0.
    if (priceMax !== undefined && priceMax !== null) {
      const effectivePrice = e.priceLow ?? e.priceHigh ?? 0;
      if (effectivePrice > priceMax) return false;
    }

    // Text search: accent-folded, case-insensitive, against title + venue.
    if (searchRe) {
      const titleNorm = normalize(e.title);
      const venueNorm = e.venue ? normalize(e.venue) : '';
      if (!searchRe.test(titleNorm) && !searchRe.test(venueNorm)) return false;
    }

    return true;
  });
}
