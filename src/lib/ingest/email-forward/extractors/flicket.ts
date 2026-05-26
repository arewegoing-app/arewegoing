/**
 * Extractor for *@flicket.co.nz order confirmation emails.
 *
 * Subject: "Your order has been confirmed! XXX-YYYY - TITLE"
 * The order number format is typically 3-digit letters + hyphen + 4 digits.
 */
import type { InboundEmail } from '../parser';
import type { EmailParseResult } from '../parser';

// "Your order has been confirmed! ABC-1234 - Event Title"
const SUBJECT_RE = /^Your order has been confirmed!\s*([A-Z]{2,5}-\d{3,6})\s*-\s*(.+)/i;

// Price pattern: "$55.00" or "NZD 55"
const PRICE_RE = /(?:NZD\s*|\$\s*)(\d+(?:\.\d{1,2})?)/i;

// Flicket event URLs (promoter subdomain pattern)
const URL_RE = /https?:\/\/[a-z0-9-]+\.flicket\.co\.nz\/[^\s"'<>]+/i;

export function extract(email: InboundEmail): EmailParseResult {
  const subjectMatch = email.subject.match(SUBJECT_RE);
  if (!subjectMatch) {
    return { ok: false, reason: 'flicket_subject_mismatch' };
  }

  const orderNumber = subjectMatch[1].trim();
  const title = subjectMatch[2].trim();

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
      source: 'flicket',
    },
  };
}
