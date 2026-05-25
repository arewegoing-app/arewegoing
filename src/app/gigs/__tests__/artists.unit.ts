import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedArtistEvent } from '../lib/artists/songkick';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';
// Ensure no real Songkick key leaks in — the mock overrides the fetch anyway.
delete process.env.SONGKICK_API_KEY;

const DATA_DIR = join(process.cwd(), '.gigs-data');
const OUTBOX = join(process.cwd(), '.gigs-outbox');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
if (existsSync(OUTBOX)) rmSync(OUTBOX, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const outboxCount = () =>
  existsSync(OUTBOX) ? readdirSync(OUTBOX).filter((f) => f.endsWith('.json')).length : 0;

// Two fake NZ events returned by the Songkick mock.
const BASE_EVENTS: ParsedArtistEvent[] = [
  {
    title: 'Four Tet (NZ Tour)',
    venue: 'San Fran',
    city: 'Wellington',
    startDate: '2026-07-15T21:00:00',
    sourceUrl: 'https://www.songkick.com/concerts/123456-four-tet-at-san-fran',
  },
  {
    title: 'Four Tet (Auckland)',
    venue: 'Powerstation',
    city: 'Auckland',
    startDate: '2026-07-16T21:00:00',
    sourceUrl: 'https://www.songkick.com/concerts/123457-four-tet-at-powerstation',
  },
];

async function main() {
  const { db, ensureMigrated } = await import('../lib/db/client');
  await ensureMigrated();
  const schema = await import('../lib/db/schema');
  const { dispatchArtistNotifications } = await import('../lib/artists/dispatch');

  // Seed: one artist with a songkick ID and one subscriber.
  const [artist] = await db
    .insert(schema.artists)
    .values({ name: 'Four Tet', normalizedName: 'four tet', songkickId: 'sk-99999' })
    .returning();

  await db.insert(schema.artistSubscriptions).values({
    artistId: artist.id,
    email: 'fan@test.nz',
  });

  // Mock: returns the two fake events.
  const mockFetch = async (_id: string): Promise<ParsedArtistEvent[]> => [...BASE_EVENTS];

  // --- Pass 1: first dispatch creates 2 draft events + sends 2 emails. ---
  const now = new Date('2026-05-25T00:00:00Z');
  const r1 = await dispatchArtistNotifications(now, mockFetch);
  assert.equal(r1.sent, 2, `Pass 1: expected 2 sent, got ${r1.sent}`);

  // Verify 2 event rows were created (drafted from Songkick).
  const allEvents = await db.select().from(schema.events);
  const draftedEvents = allEvents.filter((e) => e.source === 'songkick');
  assert.equal(draftedEvents.length, 2, `Pass 1: expected 2 drafted events, got ${draftedEvents.length}`);

  // Verify eventArtistLinks rows created.
  const links = await db.select().from(schema.eventArtistLinks).where(
    (await import('drizzle-orm')).eq(schema.eventArtistLinks.artistId, artist.id),
  );
  assert.equal(links.length, 2, `Pass 1: expected 2 artist links`);

  // Verify emails in outbox.
  assert.equal(outboxCount(), 2, `Pass 1: expected 2 outbox files`);
  console.log('OK: first dispatch creates 2 events, 2 artist links, sends 2 emails');

  // --- Pass 2: idempotent — watermark advanced, no new events. ---
  const countBefore = outboxCount();
  const r2 = await dispatchArtistNotifications(now, mockFetch);
  assert.equal(r2.sent, 0, `Pass 2: expected 0 sent, got ${r2.sent}`);
  assert.equal(outboxCount(), countBefore, `Pass 2: outbox should not grow`);
  console.log('OK: second dispatch is idempotent (0 sent)');

  // --- Pass 3: add a third event — exactly 1 new email sent. ---
  const THIRD_EVENT: ParsedArtistEvent = {
    title: 'Four Tet (Christchurch)',
    venue: 'Darkroom',
    city: 'Christchurch',
    startDate: '2026-07-17T21:00:00',
    sourceUrl: 'https://www.songkick.com/concerts/123458-four-tet-at-darkroom',
  };
  const mockFetchWith3 = async (_id: string): Promise<ParsedArtistEvent[]> => [
    ...BASE_EVENTS,
    THIRD_EVENT,
  ];

  const r3 = await dispatchArtistNotifications(now, mockFetchWith3);
  assert.equal(r3.sent, 1, `Pass 3: expected 1 sent, got ${r3.sent}`);

  // Total drafted events should now be 3.
  const allEventsAfter = await db.select().from(schema.events);
  const draftedAfter = allEventsAfter.filter((e) => e.source === 'songkick');
  assert.equal(draftedAfter.length, 3, `Pass 3: expected 3 drafted events total`);
  console.log('OK: third event triggers exactly 1 new send');

  console.log('All artist unit tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
