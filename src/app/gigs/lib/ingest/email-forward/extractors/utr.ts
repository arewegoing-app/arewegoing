/**
 * Extractor for info@undertheradar.co.nz ticket confirmation emails.
 *
 * Subject: "Your Ticket From UnderTheRadar"
 * Body contains: "Event TITLE Venue VENUE_NAME, CITY When DATE"
 */
import type { InboundEmail } from '../parser';
import type { EmailParseResult } from '../parser';

const SUBJECT_RE = /Your Ticket From UnderTheRadar/i;

// "Event TITLE" line — title follows "Event" keyword on the same or next line
const EVENT_RE = /Event\s+(.+)/i;

// "Venue VENUE_NAME, CITY" — city is optional after comma
const VENUE_RE = /Venue\s+([^,\n]+)(?:,\s*([^\n]+))?/i;

// "When DATE_STRING"
const WHEN_RE = /When\s+(.+)/i;

// NZ date: "Saturday 14 June 2025"
const DATE_NZ_RE = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i;

// Price: "$NNN" or "NZD NNN"
const PRICE_RE = /(?:NZD\s*|\$\s*)(\d+(?:\.\d{1,2})?)/i;

// Under the Radar URLs
const URL_RE = /https?:\/\/(?:www\.)?undertheradar\.co\.nz\/[^\s"'<>]+/i;

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseDate(raw: string): string | undefined {
  const m = raw.match(DATE_NZ_RE);
  if (!m) return undefined;
  const day = m[1].padStart(2, '0');
  const month = String(MONTH_MAP[m[2].toLowerCase()] ?? 1).padStart(2, '0');
  const year = m[3];
  return new Date(`${year}-${month}-${day}T19:00:00.000Z`).toISOString();
}

export function extract(email: InboundEmail): EmailParseResult {
  if (!SUBJECT_RE.test(email.subject)) {
    return { ok: false, reason: 'utr_subject_mismatch' };
  }

  const eventMatch = email.text.match(EVENT_RE);
  if (!eventMatch) {
    return { ok: false, reason: 'utr_event_not_found' };
  }
  const title = eventMatch[1].trim();

  const venueMatch = email.text.match(VENUE_RE);
  const venue = venueMatch ? venueMatch[1].trim() : undefined;
  const city = venueMatch?.[2] ? venueMatch[2].trim() : undefined;

  const whenMatch = email.text.match(WHEN_RE);
  const startsAt = whenMatch ? parseDate(whenMatch[1]) : undefined;

  const priceMatch = email.text.match(PRICE_RE);
  const priceLow = priceMatch ? Math.floor(Number(priceMatch[1])) : undefined;

  const urlMatch = email.text.match(URL_RE) ?? email.html.match(URL_RE);
  const sourceUrl = urlMatch ? urlMatch[0] : undefined;

  return {
    ok: true,
    meta: {
      title,
      venue,
      city,
      startsAt,
      priceLow,
      sourceUrl,
      source: 'undertheradar',
    },
  };
}
