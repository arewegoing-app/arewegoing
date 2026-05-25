import type { Event } from '../db/schema';

/**
 * Collapse same-real-world events that appear under multiple source URLs
 * (e.g. Bryan Gee on both Humanitix and Under the Radar). Two events are
 * treated as the same if their normalised title key matches AND they're on
 * the same calendar day in NZ.
 *
 * Picks one canonical row per group — preferring the UTR entry when present
 * (its metadata is usually richer for Wellington gigs), then by latest
 * discoveredAt timestamp.
 */
export function dedupeEvents<E extends Pick<Event, 'id' | 'title' | 'startsAt' | 'source' | 'discoveredAt'>>(
  events: E[],
): E[] {
  const groups = new Map<string, E[]>();
  for (const e of events) {
    const key = makeKey(e.title, e.startsAt);
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const result: E[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      result.push(list[0]);
      continue;
    }
    const sorted = [...list].sort((a, b) => {
      const aw = sourceWeight(a.source);
      const bw = sourceWeight(b.source);
      if (aw !== bw) return bw - aw;
      const at = a.discoveredAt ? new Date(a.discoveredAt).getTime() : 0;
      const bt = b.discoveredAt ? new Date(b.discoveredAt).getTime() : 0;
      return bt - at;
    });
    result.push(sorted[0]);
  }
  return result;
}

function makeKey(title: string, startsAt: Date | null): string {
  // Normalise the title: lowercase, expand city abbreviations, drop common
  // promoter filler words, drop stop words, keep just the strong tokens.
  const norm = title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\bwlg\b/g, 'wellington')
    .replace(/\bakl\b/g, 'auckland')
    .replace(/\bchch\b/g, 'christchurch')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(presents?|featuring|feat|w\/|with|the|and|a|an|nz|uk|us|usa|de|au|wellington|auckland|christchurch)\b/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .sort()
    .join(' ');
  const day = startsAt ? new Date(startsAt).toISOString().slice(0, 10) : 'tbd';
  return `${day}|${norm}`;
}

function sourceWeight(source: string): number {
  // Prefer UTR for Wellington gigs since its data is richest.
  switch (source) {
    case 'undertheradar': return 5;
    case 'humanitix': return 4;
    case 'moshtix': return 3;
    case 'flicket': return 2;
    case 'ticketfairy': return 1;
    default: return 0;
  }
}
