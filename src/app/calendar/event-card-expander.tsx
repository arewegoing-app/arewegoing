'use client';

import Link from 'next/link';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  TicketCheckIcon,
  TicketIcon,
  XCircleIcon,
} from 'lucide-react';
import { withRef } from '@/lib/outbound/with-ref';
import { CalendarReactions } from './reactions-row';
import { ClaimForm } from './claim-form';
import { SeriesFollowButton } from './series-follow';
import type { ClientEvent } from './client-filter';

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

type EventCardExpanderProps = {
  event: ClientEvent;
  tally: Tally | undefined;
  resaleCount: number;
  isFollowingSeries: boolean;
  indexLabel: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
};

/**
 * EventCardExpander — a client component that wraps an event card with
 * tap-to-expand behaviour.
 *
 * When expanded, shows the reactions row, share, and outbound ticket link.
 * No-JS fallback: the card title links to /e/[slug] and the toggle button
 * is not rendered (buttons require JS to function).
 */
export function EventCardExpander({
  event,
  tally,
  resaleCount,
  isFollowingSeries,
  indexLabel,
  isExpanded,
  onToggleExpand,
}: EventCardExpanderProps) {
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

  const toggleLabel = isExpanded
    ? `Hide details for ${event.title}`
    : `Show details for ${event.title}`;

  const handleToggle = () => {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      document.startViewTransition(() => {
        onToggleExpand(event.id);
      });
    } else {
      onToggleExpand(event.id);
    }
  };

  return (
    <li
      className="ed-card flex flex-col"
      style={{ border: '0' }}
      data-testid="event-card"
      data-expanded={isExpanded ? 'true' : 'false'}
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
              onClick={(e) => e.stopPropagation()}
            >
              {event.title}
            </a>
          ) : (
            event.title
          )}
        </h3>

        {/* Venue */}
        <div
          className="u-mono leading-snug"
          style={{ color: 'var(--ed-fg-soft)' }}
          data-card-venue=""
        >
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

        {/* Expand toggle button — only rendered when JS is available */}
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={toggleLabel}
          onClick={handleToggle}
          className="u-mono inline-flex items-center gap-2 self-start hover:text-[color:var(--ed-accent-2)]"
          style={{ color: 'var(--ed-fg-soft)', minHeight: '36px' }}
        >
          {isExpanded ? (
            <>
              <ChevronUpIcon className="size-4" aria-hidden="true" />
              <span>Hide details</span>
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-4" aria-hidden="true" />
              <span>Show details</span>
            </>
          )}
        </button>
      </div>

      {/* Expanded panel — shown when isExpanded is true */}
      {isExpanded && (
        <div
          className="border-t border-[color:var(--ed-line)]"
          style={{
            overflow: 'hidden',
            maxWidth: '100%',
          }}
        >
          {/* Reactions row */}
          <div className="border-b border-[color:var(--ed-line)] p-4 sm:p-5">
            <CalendarReactions eventId={event.id} />
          </div>

          {/* Ticket link with ref */}
          {event.ticketUrl && (
            <div className="p-4 sm:p-5">
              <a
                href={withRef(event.ticketUrl)}
                target="_blank"
                rel="noreferrer"
                className="u-mono inline-flex items-center gap-1 hover:text-[color:var(--ed-accent-2)]"
                style={{ color: 'var(--ed-fg-soft)' }}
                onClick={(e) => e.stopPropagation()}
              >
                ↳ Get tickets <span aria-hidden>↗</span>
              </a>
            </div>
          )}

          {/* Event detail link */}
          <div className="border-t border-[color:var(--ed-line)] p-4 sm:p-5">
            <Link
              href={`/e/${event.slug}`}
              className="u-mono inline-flex items-center gap-1 hover:text-[color:var(--ed-accent-2)]"
              style={{ color: 'var(--ed-fg-soft)' }}
            >
              ↳ Event page <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      )}

      {/* Collapsed: reactions row below the card body */}
      {!isExpanded && (
        <div className="border-t border-[color:var(--ed-line)] p-4 sm:p-5">
          <CalendarReactions eventId={event.id} />
        </div>
      )}

      {/* Ticket source link in collapsed state */}
      {!isExpanded && event.ticketUrl && (
        <div className="border-t border-[color:var(--ed-line)] px-4 pb-4 sm:px-5 sm:pb-5">
          <a
            href={withRef(event.ticketUrl)}
            target="_blank"
            rel="noreferrer"
            className="u-mono inline-flex items-center gap-1 self-start hover:text-[color:var(--ed-accent-2)]"
            style={{ color: 'var(--ed-fg-soft)' }}
            onClick={(e) => e.stopPropagation()}
          >
            ↳ {shortUrl(event.ticketUrl)} <span aria-hidden>↗</span>
          </a>
        </div>
      )}

      {/* Rally CTA — only when 3+ are down and unclaimed */}
      {readyToRally && (
        <div
          className="border-t border-[color:var(--ed-line)] p-4 sm:p-5"
          style={{ background: 'var(--ed-accent)' }}
        >
          <div className="u-mono mb-2">↳ {downCount} friends down — rally now</div>
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
    <div
      className="u-mono flex flex-wrap items-center gap-3"
      style={{ color: 'var(--ed-fg-soft)' }}
    >
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

function shortUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}
