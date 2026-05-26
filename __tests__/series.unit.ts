import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
const OUTBOX = join(process.cwd(), '.gigs-outbox');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
if (existsSync(OUTBOX)) rmSync(OUTBOX, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const outboxCount = () => (existsSync(OUTBOX) ? readdirSync(OUTBOX).filter((f) => f.endsWith('.json')).length : 0);
const outboxSubjects = () =>
  existsSync(OUTBOX)
    ? readdirSync(OUTBOX)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(OUTBOX, f), 'utf8')).subject as string)
    : [];

async function main() {
  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();
  const schema = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { dispatchSeriesNotifications } = await import('@/lib/series/dispatch');

  // Two events in the "Goodthings Sessions" series, one in another series.
  const [user] = await db.insert(schema.users).values({ email: 'sub@t', name: 'Subscriber' }).returning();
  await db.insert(schema.events).values([
    { slug: 'gt-1', ownerUserId: user.id, title: 'Goodthings Sessions #019', seriesName: 'Goodthings Sessions', startsAt: new Date('2026-06-01T10:00:00Z'), venue: 'BL3 Bar' },
    { slug: 'gt-2', ownerUserId: user.id, title: 'Goodthings Sessions #020', seriesName: 'Goodthings Sessions', startsAt: new Date('2026-07-01T10:00:00Z'), venue: 'BL3 Bar' },
    { slug: 'other', ownerUserId: user.id, title: 'Some Other Gig', seriesName: 'Different Series', startsAt: new Date('2026-06-15T10:00:00Z') },
  ]);

  // Subscriber for Goodthings.
  await db.insert(schema.seriesSubscriptions).values({
    seriesName: 'Goodthings Sessions',
    userId: user.id,
    email: 'sub@t',
  });

  // First dispatch: both Goodthings events fire, neither Different Series.
  const r1 = await dispatchSeriesNotifications();
  assert.equal(r1.sent, 2, `expected 2 sent, got ${r1.sent}`);
  const subjects = outboxSubjects();
  assert.ok(subjects.every((s) => s.includes('Goodthings Sessions')));
  assert.ok(subjects.some((s) => s.includes('#019')));
  assert.ok(subjects.some((s) => s.includes('#020')));
  console.log('OK: subscriber gets both Goodthings events; other series ignored');

  // Second dispatch immediately after: idempotent.
  const beforeIdem = outboxCount();
  const r2 = await dispatchSeriesNotifications();
  assert.equal(r2.sent, 0);
  assert.equal(outboxCount(), beforeIdem);
  console.log('OK: rerun is idempotent (notified_through_id advanced)');

  // Add a new Goodthings event. Next dispatch should send only that one.
  await db.insert(schema.events).values({
    slug: 'gt-3', ownerUserId: user.id, title: 'Goodthings Sessions #021', seriesName: 'Goodthings Sessions', startsAt: new Date('2026-08-01T10:00:00Z'),
  });
  const r3 = await dispatchSeriesNotifications();
  assert.equal(r3.sent, 1, `expected 1 new send, got ${r3.sent}`);
  console.log('OK: new event triggers exactly one fresh notification');

  console.log('All series unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
