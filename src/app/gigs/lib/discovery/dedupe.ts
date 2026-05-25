import type { Event } from '../db/schema';

/**
 * Collapse same-real-world events that appear under multiple source URLs
 * (e.g. Bryan Gee on both Humanitix and Under the Radar; Cuba St Sunday
 * Sessions listed under different titles on each platform).
 *
 * Two events match if EITHER:
 *   1. Same seriesName + same calendar day (high-confidence fast path —
 *      promoters use the same series name across platforms, e.g. "Sunday
 *      Sessions"), OR
 *   2. Same venue + same calendar day (catches cases where two listings
 *      describe the same gig with very different titles but identical venue
 *      + date — the real-world signal that pins identity), OR
 *   3. Normalised title tokens + same calendar day (fallback for events
 *      with no series/venue metadata).
 *
 * Picks one canonical row per group — preferring UTR > Humanitix > Moshtix
 * > Flicket > TicketFairy, then by latest discoveredAt.
 */
type EventLike = Pick<
  Event,
  'id' | 'title' | 'startsAt' | 'source' | 'discoveredAt' | 'seriesName' | 'venue'
>;

export function dedupeEvents<E extends EventLike>(events: E[]): E[] {
  const groups = new Map<string, E[]>();
  for (const e of events) {
    const key = makeKey(e);
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

function makeKey(e: EventLike): string {
  const day = e.startsAt ? new Date(e.startsAt).toISOString().slice(0, 10) : 'tbd';

  // 1. Series + day match — promoters reuse series names across platforms.
  if (e.seriesName) {
    const s = e.seriesName.toLowerCase().replace(/\s+/g, ' ').trim();
    return `series|${day}|${s}`;
  }

  // 2. Venue + day match — same room on same night is almost certainly one gig.
  if (e.venue) {
    const v = e.venue.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return `venue|${day}|${v}`;
  }

  // 3. Token fallback — normalise the title, drop filler, sort.
  const norm = e.title
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
  return `title|${day}|${norm}`;
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
