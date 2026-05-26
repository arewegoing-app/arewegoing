/**
 * Extractor for support@ticketfairy.com order confirmation emails.
 *
 * Subject: "Order Confirmation for TITLE"
 * Body contains date and price.
 */
import type { InboundEmail } from '../parser';
import type { EmailParseResult } from '../parser';

// "Order Confirmation for TITLE"
const SUBJECT_RE = /^Order Confirmation for (.+)/i;

// Date in text body
const DATE_NZ_RE = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i;

// Price: "$NNN" or "NZD NNN" or "USD NNN"
const PRICE_RE = /(?:USD|NZD|AUD|\$)\s*(\d+(?:\.\d{1,2})?)/i;

// Venue: "Venue: VENUE_NAME" or "at VENUE"
const VENUE_RE = /Venue:\s*(.+)/i;

// TicketFairy URLs
const URL_RE = /https?:\/\/(?:www\.)?ticketfairy\.com\/[^\s"'<>]+/i;

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseDate(text: string): string | undefined {
  const m = text.match(DATE_NZ_RE);
  if (!m) return undefined;
  const day = m[1].padStart(2, '0');
  const month = String(MONTH_MAP[m[2].toLowerCase()] ?? 1).padStart(2, '0');
  const year = m[3];
  return new Date(`${year}-${month}-${day}T19:00:00.000Z`).toISOString();
}

export function extract(email: InboundEmail): EmailParseResult {
  const subjectMatch = email.subject.match(SUBJECT_RE);
  if (!subjectMatch) {
    return { ok: false, reason: 'ticketfairy_subject_mismatch' };
  }

  const title = subjectMatch[1].trim();

  const venueMatch = email.text.match(VENUE_RE);
  const venue = venueMatch ? venueMatch[1].trim() : undefined;

  const startsAt = parseDate(email.text);

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
      source: 'ticketfairy',
    },
  };
}
