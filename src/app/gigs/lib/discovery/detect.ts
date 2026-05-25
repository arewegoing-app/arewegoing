import { knownPromoterSeries, knownVenues } from './seed-urls';

export function detectSeries(title: string): string | null {
  for (const { name, match } of knownPromoterSeries) if (match.test(title)) return name;
  return null;
}

export function normalizeVenue(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const r = raw.trim();
  for (const v of knownVenues) {
    if (r.toLowerCase().includes(v.toLowerCase())) return v;
  }
  return r;
}
