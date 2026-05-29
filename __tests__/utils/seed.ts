/**
 * Seed helper for adversarial e2e specs.
 *
 * Inserts a known set of events via the app's PGlite database (the same DB
 * the dev server uses) so tests have stable, predictable data.
 *
 * Usage:
 *   import { seedEvents, cleanupSeed } from './utils/seed';
 *   const ids = await seedEvents();
 *   // ... tests ...
 *   await cleanupSeed(ids);
 *
 * This module uses the app's existing db client so it goes through the same
 * schema migrations as the server.
 */

import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const DATA_DIR = join(process.cwd(), '.gigs-data');

/** IDs returned after seeding so callers can reference or clean up. */
export type SeedIds = {
  eventWithTicketId: string;
  eventWithTicketSlug: string;
  otherEventIds: string[];
};

let seeded = false;
let cachedIds: SeedIds | null = null;

/** Ensure DB is initialised and insert known test events. Idempotent within a run. */
export async function seedEvents(): Promise<SeedIds> {
  if (seeded && cachedIds) return cachedIds;

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // Load the app's DB client (uses PGlite on disk in dev / test).
  const { ensureMigrated, db } = await import('@/lib/db/client');
  await ensureMigrated();

  const { events: eventsTable } = await import('@/lib/db/schema');
  const { nanoid } = await import('nanoid');

  const now = new Date();
  const futureDate = (offsetDays: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d;
  };

  // Five events: 3 venues, different titles, different start times.
  // One has a ticketUrl so withRef integration tests can find it.
  const seedData = [
    {
      id: nanoid(),
      slug: `seed-event-ticket-${nanoid(6)}`,
      title: 'Moshtix Test Event — With Ticket',
      venue: 'San Fran',
      city: 'Wellington',
      startsAt: futureDate(7),
      ticketUrl: 'https://moshtix.co.nz/event/abc?utm_source=test',
      source: 'manual' as const,
      status: 'active',
    },
    {
      id: nanoid(),
      slug: `seed-event-2-${nanoid(6)}`,
      title: 'Seed Event Two — No Ticket',
      venue: 'Meow',
      city: 'Wellington',
      startsAt: futureDate(14),
      source: 'manual' as const,
      status: 'active',
    },
    {
      id: nanoid(),
      slug: `seed-event-3-${nanoid(6)}`,
      title: 'Seed Event Three — Bodega',
      venue: 'Bodega',
      city: 'Wellington',
      startsAt: futureDate(21),
      source: 'manual' as const,
      status: 'active',
    },
    {
      id: nanoid(),
      slug: `seed-event-4-${nanoid(6)}`,
      title: 'Seed Event Four — San Fran Late',
      venue: 'San Fran',
      city: 'Wellington',
      startsAt: futureDate(28),
      source: 'manual' as const,
      status: 'active',
    },
    {
      id: nanoid(),
      slug: `seed-event-5-${nanoid(6)}`,
      title: 'Seed Event Five — Meow Late',
      venue: 'Meow',
      city: 'Wellington',
      startsAt: futureDate(35),
      source: 'manual' as const,
      status: 'active',
    },
  ];

  const inserted = await db
    .insert(eventsTable)
    .values(seedData)
    .onConflictDoNothing()
    .returning({ id: eventsTable.id, slug: eventsTable.slug });

  // If all already existed (re-run), look them up by slug prefix.
  const ticket = inserted.find((r) =>
    seedData[0] ? r.id === seedData[0].id : false,
  ) ?? inserted[0];

  cachedIds = {
    eventWithTicketId: ticket?.id ?? seedData[0].id,
    eventWithTicketSlug: ticket?.slug ?? seedData[0].slug,
    otherEventIds: inserted.slice(1).map((r) => r.id),
  };
  seeded = true;
  return cachedIds;
}

/** Remove seed rows by ID. Safe to call even if rows don't exist. */
export async function cleanupSeed(ids: SeedIds): Promise<void> {
  try {
    const { db } = await import('@/lib/db/client');
    const { events: eventsTable } = await import('@/lib/db/schema');
    const { inArray } = await import('drizzle-orm');
    const allIds = [ids.eventWithTicketId, ...ids.otherEventIds];
    await db
      .delete(eventsTable)
      .where(inArray(eventsTable.id, allIds));
    seeded = false;
    cachedIds = null;
  } catch {
    // Best-effort cleanup; test isolation still holds via slug uniqueness.
  }
}
