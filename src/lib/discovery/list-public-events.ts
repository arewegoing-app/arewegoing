import { and, asc, gte, lte, or, isNull, eq, ilike } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { dedupeEvents } from './dedupe';

export type PublicEventsFilter = {
  userId?: string;
  q?: string;
  venue?: string;
  from?: string;
  to?: string;
  priceMax?: number;
};

export type PublicEventsResult = {
  upcoming: (typeof events.$inferSelect)[];
  tbd: (typeof events.$inferSelect)[];
  dedupedUpcoming: (typeof events.$inferSelect)[];
  dedupedTbd: (typeof events.$inferSelect)[];
  allShown: (typeof events.$inferSelect)[];
};

/**
 * Fetch public events for the next 90 days plus TBD events.
 * Extracted from calendar/page.tsx so it can be reused in group calendar pages.
 */
export async function listPublicEvents(filter: PublicEventsFilter): Promise<PublicEventsResult> {
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const ownershipFilter = filter.userId
    ? or(isNull(events.ownerUserId), eq(events.ownerUserId, filter.userId))!
    : isNull(events.ownerUserId);

  const fromDate = filter.from ? new Date(filter.from) : undefined;
  const toDate = filter.to
    ? (() => {
        const d = new Date(filter.to!);
        d.setHours(23, 59, 59, 999);
        return d;
      })()
    : undefined;

  const searchFilter =
    filter.q != null
      ? or(ilike(events.title, `%${filter.q}%`), ilike(events.venue, `%${filter.q}%`))
      : undefined;
  const venueFilter = filter.venue != null ? eq(events.venue, filter.venue) : undefined;
  const priceFilter = filter.priceMax != null ? lte(events.priceLow, filter.priceMax) : undefined;

  const upcoming = await db
    .select()
    .from(events)
    .where(
      and(
        ownershipFilter,
        gte(events.startsAt, fromDate ?? now),
        lte(events.startsAt, toDate ?? ninetyDaysOut),
        searchFilter,
        venueFilter,
        priceFilter,
      )!,
    )
    .orderBy(asc(events.startsAt));

  const tbd =
    filter.from || filter.to
      ? []
      : await db
          .select()
          .from(events)
          .where(
            and(
              ownershipFilter,
              isNull(events.startsAt),
              searchFilter,
              venueFilter,
              priceFilter,
            )!,
          );

  const allShown = dedupeEvents([...upcoming, ...tbd]);
  const dedupedUpcoming = allShown.filter((e) => e.startsAt !== null);
  const dedupedTbd = allShown.filter((e) => e.startsAt === null);

  return { upcoming, tbd, dedupedUpcoming, dedupedTbd, allShown };
}
