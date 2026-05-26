import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
const OUTBOX = join(process.cwd(), '.gigs-outbox');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
if (existsSync(OUTBOX)) rmSync(OUTBOX, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const outboxCount = (): number =>
  existsSync(OUTBOX) ? readdirSync(OUTBOX).filter((f) => f.endsWith('.json')).length : 0;

async function main() {
  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();

  const schema = await import('@/lib/db/schema');
  const { eq, and, isNull } = await import('drizzle-orm');
  const { dispatchPostEventFeedback } = await import('@/lib/notifications/feedback');
  const { signToken, verifyToken } = await import('@/lib/tokens/token-service');

  // ── Setup ─────────────────────────────────────────────────────────────────
  const [buyer] = await db
    .insert(schema.users)
    .values({ email: 'buyer@feedback.test', name: 'Buyer' })
    .returning();

  // Event that started 30 hours ago — inside the 24-48 h window.
  const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'fb-event-1', ownerUserId: buyer.id, title: 'Feedback Test Gig', startsAt: thirtyHoursAgo })
    .returning();

  const [r1] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'going1@t', displayName: 'Going One' }).returning();
  const [r2] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'going2@t', displayName: 'Going Two' }).returning();
  const [r3] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'out@t', displayName: 'Out Person' }).returning();

  const [i1] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r1.id }).returning();
  const [i2] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r2.id }).returning();
  const [i3] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r3.id }).returning();

  // r1 and r2 are going; r3 is out.
  await db.insert(schema.rsvps).values({ eventInviteId: i1.id, status: 'going' });
  await db.insert(schema.rsvps).values({ eventInviteId: i2.id, status: 'going' });
  await db.insert(schema.rsvps).values({ eventInviteId: i3.id, status: 'out' });

  // ── Test 1: first dispatch sends to 2 (going), skips the 'out' recipient ─
  const first = await dispatchPostEventFeedback();
  assert.equal(first.sent, 2, `expected 2 sent, got ${first.sent}`);
  assert.equal(first.skipped, 0, `expected 0 skipped, got ${first.skipped}`);
  assert.equal(outboxCount(), 2, 'outbox should have 2 emails after first dispatch');
  console.log('OK: first dispatch sends 2, excludes out recipient');

  // ── Test 2: second dispatch is idempotent ─────────────────────────────────
  const second = await dispatchPostEventFeedback();
  assert.equal(second.sent, 0, `expected 0 sent on second run, got ${second.sent}`);
  assert.equal(second.skipped, 2, `expected 2 skipped on second run, got ${second.skipped}`);
  assert.equal(outboxCount(), 2, 'outbox should still have 2 emails after second dispatch');
  console.log('OK: second dispatch is idempotent (0 sent, 2 skipped)');

  // ── Test 3: recipient clicks the rating-4 link ────────────────────────────
  // Build the same token the dispatcher would have built.
  const ratingToken = signToken({
    rid: r1.id,
    eid: event.id,
    act: 'feedback.submit',
    ttlSec: 14 * 24 * 60 * 60,
  });

  // Verify the token is valid.
  const v = verifyToken(ratingToken);
  assert.equal(v.ok, true, 'rating token should verify');

  // Simulate the /gigs/r route handler logic: find the invite, find the
  // feedback row, update it.
  const [invite] = await db
    .select()
    .from(schema.eventInvites)
    .where(and(eq(schema.eventInvites.eventId, event.id), eq(schema.eventInvites.recipientId, r1.id)))
    .limit(1);
  assert.ok(invite, 'invite row should exist for r1');

  const [feedbackRow] = await db
    .select()
    .from(schema.eventFeedback)
    .where(
      and(
        eq(schema.eventFeedback.eventId, event.id),
        eq(schema.eventFeedback.eventInviteId, invite.id),
        isNull(schema.eventFeedback.anonId),
      ),
    )
    .limit(1);
  assert.ok(feedbackRow, 'event_feedback row should exist for r1 after dispatch');
  assert.equal(feedbackRow.respondedAt, null, 'respondedAt should be null before click');

  const now = new Date();
  await db
    .update(schema.eventFeedback)
    .set({ respondedAt: now, attended: 1, rating: 4 })
    .where(eq(schema.eventFeedback.id, feedbackRow.id));

  const [updated] = await db
    .select()
    .from(schema.eventFeedback)
    .where(eq(schema.eventFeedback.id, feedbackRow.id))
    .limit(1);
  assert.equal(updated.rating, 4, `expected rating 4, got ${updated.rating}`);
  assert.equal(updated.attended, 1, `expected attended 1, got ${updated.attended}`);
  assert.notEqual(updated.respondedAt, null, 'respondedAt should be set after click');
  console.log('OK: rating-4 click updates event_feedback correctly');

  // ── Test 4: 'out' recipient has no feedback row ────────────────────────────
  const [outFeedback] = await db
    .select()
    .from(schema.eventFeedback)
    .where(and(eq(schema.eventFeedback.eventId, event.id), eq(schema.eventFeedback.eventInviteId, i3.id)))
    .limit(1);
  assert.equal(outFeedback, undefined, 'out recipient should have no feedback row');
  console.log('OK: out recipient has no event_feedback row');

  console.log('All feedback unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
