/**
 * Extractor for notifications@moshtix.com booking confirmation emails.
 *
 * Subject: "Booking Confirmation And Tickets - Order #N"
 * Venue sometimes appears in HTML image alt text: alt="... at VENUE"
 * or in the text body: "at VENUE\n"
 */
import type { InboundEmail } from '../parser';
import type { EmailParseResult } from '../parser';

// "Booking Confirmation And Tickets - Order #12345"
const SUBJECT_RE = /^Booking Confirmation And Tickets\s*-\s*Order\s*#(\d+)/i;

// Title line usually follows "Event:" or appears as the first bold heading
const TITLE_RE = /Event:\s*(.+)/i;

// Venue: look for "at VENUE" pattern or img alt="something at VENUE"
const VENUE_ALT_RE = /alt="[^"]*\bat\s+([^"]+)"/i;
const VENUE_TEXT_RE = /\bat\s+([A-Z][A-Za-z0-9\s'&-]{3,40})\b/;

// Price: "$30.00" in body
const PRICE_RE = /\$\s*(\d+(?:\.\d{1,2})?)/;

// Moshtix event URL
const URL_RE = /https?:\/\/(?:www\.)?moshtix\.com(?:\.au)?\/[^\s"'<>]+/i;

export function extract(email: InboundEmail): EmailParseResult {
  const subjectMatch = email.subject.match(SUBJECT_RE);
  if (!subjectMatch) {
    return { ok: false, reason: 'moshtix_subject_mismatch' };
  }

  const orderNumber = subjectMatch[1].trim();

  // Try to find the event title in the text body
  const titleMatch = email.text.match(TITLE_RE);
  if (!titleMatch) {
    return { ok: false, reason: 'moshtix_title_not_found' };
  }
  const title = titleMatch[1].trim();

  // Venue: try HTML alt first, then text heuristic
  const venueAlt = email.html.match(VENUE_ALT_RE);
  const venueText = email.text.match(VENUE_TEXT_RE);
  const venue = venueAlt ? venueAlt[1].trim() : venueText ? venueText[1].trim() : undefined;

  const priceMatch = email.text.match(PRICE_RE);
  const priceLow = priceMatch ? Math.floor(Number(priceMatch[1])) : undefined;

  const urlMatch = email.text.match(URL_RE) ?? email.html.match(URL_RE);
  const sourceUrl = urlMatch ? urlMatch[0] : undefined;

  return {
    ok: true,
    meta: {
      title,
      venue,
      orderNumber,
      priceLow,
      sourceUrl,
      source: 'moshtix',
    },
  };
}
