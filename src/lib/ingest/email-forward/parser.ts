import { z } from 'zod';
import type { IngestSource } from '../types';

// ---------------------------------------------------------------------------
// Shared schema for all per-source extractors
// ---------------------------------------------------------------------------

export const parsedTicketSchema = z.object({
  title: z.string().min(1),
  venue: z.string().optional(),
  city: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  priceLow: z.number().int().nonnegative().optional(),
  sourceUrl: z.string().url().optional(),
  orderNumber: z.string().optional(),
  source: z.enum([
    'humanitix',
    'moshtix',
    'flicket',
    'ticketek',
    'undertheradar',
    'ticketfairy',
  ] as const),
});

export type ParsedTicket = z.infer<typeof parsedTicketSchema>;

// ---------------------------------------------------------------------------
// Inbound email shape (from webhook — Resend Inbound or SendGrid Inbound Parse)
// ---------------------------------------------------------------------------

export interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type EmailParseResult =
  | { ok: true; meta: ParsedTicket }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Per-source extractor registry
// ---------------------------------------------------------------------------

type Extractor = (email: InboundEmail) => EmailParseResult;

interface ExtractorEntry {
  /** RegExp matched against the sender address (case-insensitive). */
  senderPattern: RegExp;
  source: ParsedTicket['source'];
  extract: Extractor;
}

// Lazy-loaded to avoid circular deps if any extractor imports from parser.ts
let _registry: ExtractorEntry[] | undefined;

async function getRegistry(): Promise<ExtractorEntry[]> {
  if (_registry) return _registry;
  const [
    { extract: humanitix },
    { extract: moshtix },
    { extract: flicket },
    { extract: ticketek },
    { extract: utr },
    { extract: ticketfairy },
  ] = await Promise.all([
    import('./extractors/humanitix'),
    import('./extractors/moshtix'),
    import('./extractors/flicket'),
    import('./extractors/ticketek'),
    import('./extractors/utr'),
    import('./extractors/ticketfairy'),
  ]);

  _registry = [
    { senderPattern: /order@humanitix\.com$/i, source: 'humanitix', extract: humanitix },
    { senderPattern: /notifications@moshtix\.com$/i, source: 'moshtix', extract: moshtix },
    { senderPattern: /@(?:[a-z0-9-]+\.)?flicket\.co\.nz$/i, source: 'flicket', extract: flicket },
    { senderPattern: /confirmation@ticketek\.co\.nz$/i, source: 'ticketek', extract: ticketek },
    { senderPattern: /info@undertheradar\.co\.nz$/i, source: 'undertheradar', extract: utr },
    { senderPattern: /support@ticketfairy\.com$/i, source: 'ticketfairy', extract: ticketfairy },
  ];
  return _registry;
}

/** Extract bare address from "Display Name <addr>" format. */
function normalizeFrom(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function parseTicketEmail(mime: InboundEmail): Promise<EmailParseResult> {
  const registry = await getRegistry();
  const sender = normalizeFrom(mime.from);

  const entry = registry.find(({ senderPattern }) => senderPattern.test(sender));
  if (!entry) return { ok: false, reason: 'unsupported_sender' };

  const result = entry.extract(mime);
  if (!result.ok) return result;

  // Validate extracted data against the shared schema
  const parsed = parsedTicketSchema.safeParse(result.meta);
  if (!parsed.success) {
    return { ok: false, reason: `schema_invalid: ${parsed.error.issues[0]?.message ?? 'unknown'}` };
  }
  return { ok: true, meta: parsed.data };
}
