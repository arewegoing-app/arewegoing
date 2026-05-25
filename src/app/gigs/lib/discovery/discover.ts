import { customAlphabet } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { events } from '../db/schema';
import { ingest } from '../ingest/fetch';
import { detectSeries, normalizeVenue } from './detect';
import { seedUrls } from './seed-urls';

const makeSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export type DiscoverResult = {
  attempted: number;
  inserted: number;
  updated: number;
  failed: Array<{ url: string; reason: string }>;
};

export async function discoverFromSeed(urls: string[] = seedUrls, opts: { ingestImpl?: typeof ingest } = {}): Promise<DiscoverResult> {
  const impl = opts.ingestImpl ?? ingest;
  const result: DiscoverResult = { attempted: 0, inserted: 0, updated: 0, failed: [] };

  for (const url of urls) {
    result.attempted++;
    const r = await impl(url);
    if (!r.ok) {
      result.failed.push({ url, reason: r.reason });
      continue;
    }
    const m = r.metadata;
    const series = detectSeries(m.title);
    const venue = normalizeVenue(m.venue);

    const [existing] = await db.select().from(events).where(eq(events.sourceUrl, url)).limit(1);
    if (existing) {
      await db.update(events).set({
        title: m.title,
        venue: venue ?? m.venue ?? null,
        city: m.city ?? existing.city,
        startsAt: m.startsAt ? new Date(m.startsAt) : existing.startsAt,
        priceLow: m.priceLow ?? existing.priceLow,
        imageUrl: m.imageUrl ?? existing.imageUrl,
        ticketUrl: m.ticketUrl,
        source: m.source,
        seriesName: series ?? existing.seriesName,
      }).where(eq(events.id, existing.id));
      result.updated++;
      continue;
    }

    await db.insert(events).values({
      slug: makeSlug(),
      ownerUserId: null,
      title: m.title,
      venue: venue ?? m.venue ?? null,
      city: m.city ?? 'Wellington',
      startsAt: m.startsAt ? new Date(m.startsAt) : null,
      priceLow: m.priceLow ?? null,
      imageUrl: m.imageUrl ?? null,
      ticketUrl: m.ticketUrl,
      source: m.source,
      sourceUrl: url,
      seriesName: series,
      discoveredAt: new Date(),
    });
    result.inserted++;
  }
  return result;
}
