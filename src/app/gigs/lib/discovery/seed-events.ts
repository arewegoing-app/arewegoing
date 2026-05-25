import { customAlphabet } from 'nanoid';
import { db } from '../db/client';
import { events } from '../db/schema';
import { knownEvents } from './known-events';

const makeSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export async function seedKnownEventsIfEmpty(): Promise<{ inserted: number }> {
  const result = await db
    .insert(events)
    .values(
      knownEvents.map((k) => ({
        slug: makeSlug(),
        ownerUserId: null,
        title: k.title,
        venue: k.venue,
        city: k.city,
        startsAt: new Date(k.startsAtUTC),
        priceLow: k.priceLow ?? null,
        ticketUrl: k.sourceUrl,
        sourceUrl: k.sourceUrl,
        source: k.source,
        seriesName: k.seriesName ?? null,
        discoveredAt: new Date(),
      })),
    )
    .onConflictDoNothing({ target: events.sourceUrl })
    .returning({ id: events.id });
  return { inserted: result.length };
}
