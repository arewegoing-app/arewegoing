import { z } from 'zod';

export const ingestSources = [
  'humanitix',
  'moshtix',
  'flicket',
  'undertheradar',
  'ticketek',
  'ticketfairy',
  'ra',
  'iticket',
  'generic',
] as const;
export type IngestSource = (typeof ingestSources)[number];

export const eventMetadataSchema = z.object({
  title: z.string().min(1),
  venue: z.string().optional(),
  city: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  priceLow: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().optional(),
  ticketUrl: z.string().url(),
  source: z.enum(ingestSources),
});
export type EventMetadata = z.infer<typeof eventMetadataSchema>;

export const ingestErrorReasons = [
  'invalid_url',
  'fetch_failed',
  'timeout',
  'too_large',
  'unsupported_source',
  'no_metadata',
  'parse_failed',
] as const;
export type IngestErrorReason = (typeof ingestErrorReasons)[number];

export type IngestResult =
  | { ok: true; metadata: EventMetadata }
  | { ok: false; reason: IngestErrorReason; message?: string };
