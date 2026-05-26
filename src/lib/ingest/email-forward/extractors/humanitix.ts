/**
 * Extractor for order@humanitix.com confirmation emails.
 *
 * Subject: "Order confirmation for TITLE (Order: ORDER_NUMBER)"
 * Body contains price like "$35.00" and optionally a ticket/event URL.
 */
import type { InboundEmail } from '../parser';
import type { EmailParseResult } from '../parser';

// Matches: "Order confirmation for TITLE (Order: ORDER_NUMBER)"
const SUBJECT_RE = /^Order confirmation for (.+?)\s*\(Order:\s*([A-Z0-9-]+)\)/i;

// Matches the first dollar amount in the text body
const PRICE_RE = /\$\s*(\d+(?:\.\d{1,2})?)/;

// Humanitix event URLs
const URL_RE = /https?:\/\/(?:www\.)?humanitix\.com\/(?:au\/|nz\/)?event\/[^\s"'<>]+/i;

export function extract(email: InboundEmail): EmailParseResult {
  const subjectMatch = email.subject.match(SUBJECT_RE);
  if (!subjectMatch) {
    return { ok: false, reason: 'humanitix_subject_mismatch' };
  }

  const title = subjectMatch[1].trim();
  const orderNumber = subjectMatch[2].trim();

  const priceMatch = email.text.match(PRICE_RE);
  const priceLow = priceMatch ? Math.floor(Number(priceMatch[1])) : undefined;

  const urlMatch = email.text.match(URL_RE) ?? email.html.match(URL_RE);
  const sourceUrl = urlMatch ? urlMatch[0] : undefined;

  return {
    ok: true,
    meta: {
      title,
      orderNumber,
      priceLow,
      sourceUrl,
      source: 'humanitix',
    },
  };
}
