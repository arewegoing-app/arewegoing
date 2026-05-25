import { customAlphabet } from 'nanoid';
import { db } from '../db/client';
import { events } from '../db/schema';
import { knownEvents } from './known-events';
import { ingest } from '../ingest/fetch';
import { detectSeries, normalizeVenue } from './detect';

const makeSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
const FETCH_TIMEOUT_MS = 4000;

/**
 * Seeds the calendar idempotently. For each known URL we try to ingest the
 * live page (JSON-LD + OG tags) to get the *real* date / venue / price, and
 * fall back to the hardcoded snapshot only if the network call fails. This
 * means cold starts get accurate metadata when the network cooperates,
 * but the calendar still renders something useful when it doesn't.
 */
export async function seedKnownEventsIfEmpty(): Promise<{ inserted: number; live: number }> {
  const enriched = await Promise.all(
    knownEvents.map(async (k) => {
      try {
        const result = await Promise.race([
          ingest(k.sourceUrl),
          new Promise<null>((res) => setTimeout(() => res(null), FETCH_TIMEOUT_MS)),
        ]);
        if (result && 'ok' in result && result.ok) {
          const series = detectSeries(result.metadata.title) ?? k.seriesName ?? null;
          const venue = normalizeVenue(result.metadata.venue) ?? k.venue;
          return {
            source: result.metadata.source,
            sourceUrl: k.sourceUrl,
            title: result.metadata.title,
            venue,
            city: result.metadata.city ?? k.city,
            startsAt: result.metadata.startsAt ? new Date(result.metadata.startsAt) : null,
            priceLow: result.metadata.priceLow ?? k.priceLow ?? null,
            imageUrl: result.metadata.imageUrl ?? null,
            seriesName: series,
            live: true,
          };
        }
      } catch {
        // fall through to fallback
      }
      // Live fetch failed (timeout / blocked / no metadata). Fall back to the
      // hardcoded snapshot so the calendar still has SOMETHING to show. These
      // snapshots are our best guess and get overwritten the next time the
      // cron successfully hits the source. If a snapshot is wrong, fix it in
      // known-events.ts.
      return {
        source: k.source,
        sourceUrl: k.sourceUrl,
        title: k.title,
        venue: k.venue,
        city: k.city,
        startsAt: new Date(k.startsAtUTC),
        priceLow: k.priceLow ?? null,
        imageUrl: null as string | null,
        seriesName: k.seriesName ?? null,
        live: false,
      };
    }),
  );

  const result = await db
    .insert(events)
    .values(
      enriched.map((k) => ({
        slug: makeSlug(),
        ownerUserId: null,
        title: k.title,
        venue: k.venue,
        city: k.city,
        startsAt: k.startsAt,
        priceLow: k.priceLow,
        ticketUrl: k.sourceUrl,
        sourceUrl: k.sourceUrl,
        source: k.source,
        imageUrl: k.imageUrl,
        seriesName: k.seriesName,
        discoveredAt: new Date(),
      })),
    )
    .onConflictDoNothing({ target: events.sourceUrl })
    .returning({ id: events.id });

  return { inserted: result.length, live: enriched.filter((e) => e.live).length };
}
