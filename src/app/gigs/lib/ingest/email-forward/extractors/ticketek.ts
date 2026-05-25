/**
 * Extractor for confirmation@ticketek.co.nz purchase confirmation emails.
 *
 * Subject: "Ticketek New Zealand Purchase Confirmation"
 * Body contains event name, date, and venue.
 */
import type { InboundEmail } from '../parser';
import type { EmailParseResult } from '../parser';

const SUBJECT_RE = /Ticketek New Zealand Purchase Confirmation/i;

// "Event: TITLE" or standalone heading
const TITLE_RE = /Event(?:\s+Name)?:\s*(.+)/i;

// Venue: "Venue: VENUE_NAME" or "at VENUE_NAME"
const VENUE_RE = /Venue:\s*(.+)/i;

// Date: looks for ISO or NZ-style dates, e.g. "Saturday, 14 June 2025" or "14/06/2025"
const DATE_NZ_RE = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i;

// Price: "$NNN.NN" or "NZD NNN"
const PRICE_RE = /(?:NZD\s*|\$\s*)(\d+(?:\.\d{1,2})?)/i;

// Ticketek NZ URL
const URL_RE = /https?:\/\/(?:www\.)?ticketek\.co\.nz\/[^\s"'<>]+/i;

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseNzDate(text: string): string | undefined {
  const m = text.match(DATE_NZ_RE);
  if (!m) return undefined;
  const day = m[1].padStart(2, '0');
  const month = String(MONTH_MAP[m[2].toLowerCase()] ?? 1).padStart(2, '0');
  const year = m[3];
  return new Date(`${year}-${month}-${day}T19:00:00.000Z`).toISOString();
}

export function extract(email: InboundEmail): EmailParseResult {
  if (!SUBJECT_RE.test(email.subject)) {
    return { ok: false, reason: 'ticketek_subject_mismatch' };
  }

  const titleMatch = email.text.match(TITLE_RE);
  if (!titleMatch) {
    return { ok: false, reason: 'ticketek_title_not_found' };
  }
  const title = titleMatch[1].trim();

  const venueMatch = email.text.match(VENUE_RE);
  const venue = venueMatch ? venueMatch[1].trim() : undefined;

  const startsAt = parseNzDate(email.text);

  const priceMatch = email.text.match(PRICE_RE);
  const priceLow = priceMatch ? Math.floor(Number(priceMatch[1])) : undefined;

  const urlMatch = email.text.match(URL_RE) ?? email.html.match(URL_RE);
  const sourceUrl = urlMatch ? urlMatch[0] : undefined;

  return {
    ok: true,
    meta: {
      title,
      venue,
      startsAt,
      priceLow,
      sourceUrl,
      source: 'ticketek',
    },
  };
}
