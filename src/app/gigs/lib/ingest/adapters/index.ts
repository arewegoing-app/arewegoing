import type { IngestSource } from '../types';

const HOST_MAP: Array<{ test: RegExp; source: IngestSource }> = [
  { test: /(^|\.)humanitix\.com$/i, source: 'humanitix' },
  { test: /(^|\.)moshtix\.com(\.au)?$/i, source: 'moshtix' },
  { test: /(^|\.)moshtix\.co\.nz$/i, source: 'moshtix' },
  { test: /(^|\.)flicket\.co\.nz$/i, source: 'flicket' },
  { test: /(^|\.)flicket\.com$/i, source: 'flicket' },
  { test: /(^|\.)undertheradar\.co\.nz$/i, source: 'undertheradar' },
  { test: /(^|\.)ticketek\.co\.nz$/i, source: 'ticketek' },
  { test: /(^|\.)ticketfairy\.com$/i, source: 'ticketfairy' },
  { test: /(^|\.)ra\.co$/i, source: 'ra' },
  { test: /(^|\.)residentadvisor\.net$/i, source: 'ra' },
  { test: /(^|\.)iticket\.co\.nz$/i, source: 'iticket' },
  { test: /(^|\.)eventfinda\.co\.nz$/i, source: 'eventfinda' },
  { test: /(^|\.)eventfinda\.com$/i, source: 'eventfinda' },
  { test: /(^|\.)dice\.fm$/i, source: 'dice' },
];

export function detectSource(url: URL): IngestSource {
  for (const { test, source } of HOST_MAP) if (test.test(url.hostname)) return source;
  return 'generic';
}

export const KNOWN_BLOCKED: Array<{ test: RegExp; reason: string }> = [
  { test: /^www\.facebook\.com$|^facebook\.com$/i, reason: 'Facebook events need login. Fill the form manually.' },
  { test: /^docs\.google\.com$/i, reason: "Google Sheets can't be auto-imported. Fill the form manually." },
];
