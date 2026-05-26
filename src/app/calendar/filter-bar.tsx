import Link from 'next/link';

type FilterBarProps = {
  venues: string[];
  current: {
    q?: string;
    venue?: string;
    from?: string;
    to?: string;
    priceMax?: string;
  };
};

const inputStyle = {
  borderColor: 'var(--ed-line)',
  borderRadius: 0,
  fontFamily: 'var(--font-jbmono)',
  fontSize: '0.875rem',
  background: 'var(--ed-bg)',
  color: 'var(--ed-fg)',
  minHeight: '44px',
  // Force inputs (including native date pickers) to respect the grid cell width.
  // Without min-width:0 they use intrinsic content size and overflow on small screens.
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
} as const;

export function FilterBar({ venues, current }: FilterBarProps) {
  const hasFilters = !!(
    current.q ||
    current.venue ||
    current.from ||
    current.to ||
    current.priceMax
  );

  return (
    <section
      className="ed-card p-4 sm:p-5"
      aria-label="Filter events"
    >
      <div className="u-mono opacity-50 mb-3">[04] / Filter</div>

      <form
        action="/calendar"
        method="get"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/* [01] Free-text search */}
        <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-2">
          <label
            htmlFor="filter-q"
            className="u-mono flex items-center gap-2 opacity-70"
          >
            <span className="opacity-60">[01]</span>
            <span>Search</span>
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            placeholder="Artist, event name, venue…"
            defaultValue={current.q ?? ''}
            className="w-full border px-3 py-3"
            style={inputStyle}
            aria-label="Search events by title or venue"
          />
        </div>

        {/* [02] Venue */}
        <div className="min-w-0 space-y-1.5">
          <label
            htmlFor="filter-venue"
            className="u-mono flex items-center gap-2 opacity-70"
          >
            <span className="opacity-60">[02]</span>
            <span>Venue</span>
          </label>
          <select
            id="filter-venue"
            name="venue"
            defaultValue={current.venue ?? ''}
            className="w-full border px-3 py-3"
            style={{ ...inputStyle, appearance: 'none' as const }}
            aria-label="Filter by venue"
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
          <label
            htmlFor="filter-from"
            className="u-mono flex items-center gap-2 opacity-70"
          >
            <span className="opacity-60">[03]</span>
            <span>From</span>
          </label>
          <input
            id="filter-from"
            name="from"
            type="date"
            defaultValue={current.from ?? ''}
            className="w-full border px-3 py-3"
            style={inputStyle}
            aria-label="Filter events starting from date"
          />
        </div>

        {/* [04] To date */}
        <div className="min-w-0 space-y-1.5">
          <label
            htmlFor="filter-to"
            className="u-mono flex items-center gap-2 opacity-70"
          >
            <span className="opacity-60">[04]</span>
            <span>To</span>
          </label>
          <input
            id="filter-to"
            name="to"
            type="date"
            defaultValue={current.to ?? ''}
            className="w-full border px-3 py-3"
            style={inputStyle}
            aria-label="Filter events ending by date"
          />
        </div>

        {/* [05] Max price */}
        <div className="min-w-0 space-y-1.5">
          <label
            htmlFor="filter-price"
            className="u-mono flex items-center gap-2 opacity-70"
          >
            <span className="opacity-60">[05]</span>
            <span>Max price (NZD)</span>
          </label>
          <input
            id="filter-price"
            name="priceMax"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="e.g. 50"
            defaultValue={current.priceMax ?? ''}
            className="w-full border px-3 py-3"
            style={inputStyle}
            aria-label="Maximum ticket price in NZD"
          />
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="ed-chip">
            ↳ Apply filters
          </button>
          {hasFilters && (
            <Link
              href="/calendar"
              className="ed-chip"
              aria-label="Clear all filters"
            >
              ↳ Clear filters
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
