import type { Event } from '../db/schema';

/**
 * Collapse same-real-world events that appear under multiple source URLs.
 *
 * Match tiers, strongest first:
 *   1. Same venue + same start time (within 1h bucket) — strongest signal.
 *      Two listings describing a 9pm Saturday gig at San Fran are the same
 *      gig regardless of how the titles differ. Avoids the false-positive
 *      where two separate shows at the same venue on the same calendar day
 *      get merged.
 *   2. Same seriesName + same calendar day — promoters reuse series names
 *      across platforms ("Sunday Sessions", "Goodthings", "Rhythm Output").
 *   3. Same venue + same calendar day — fallback when one listing has no
 *      time. Looser than #1 but tighter than nothing.
 *   4. Title tokens + same calendar day — last resort for events with no
 *      venue or series metadata.
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
  const startsAt = e.startsAt ? new Date(e.startsAt) : null;
  const day = startsAt ? startsAt.toISOString().slice(0, 10) : 'tbd';
  const venueKey = e.venue ? e.venue.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : null;

  // 1. Venue + start time (hour bucket) — strongest. Same room + same hour
  //    is almost certainly the same gig even if the listings have different
  //    titles, promoter framing, or pricing tiers. Two SEPARATE shows at the
  //    same venue on different times (early + late) stay distinct.
  if (venueKey && startsAt) {
    const hour = `${day}T${String(startsAt.getUTCHours()).padStart(2, '0')}`;
    return `vt|${hour}|${venueKey}`;
  }

  // 2. Series + day — promoters reuse series names across platforms.
  if (e.seriesName) {
    const s = e.seriesName.toLowerCase().replace(/\s+/g, ' ').trim();
    return `series|${day}|${s}`;
  }

  // 3. Venue + day (no time on one of the rows) — looser fallback.
  if (venueKey) {
    return `venue|${day}|${venueKey}`;
  }

  // 4. Title tokens + day — last resort.
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
