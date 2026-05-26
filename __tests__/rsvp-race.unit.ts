import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();

  const schema = await import('@/lib/db/schema');
  const { signToken } = await import('@/lib/tokens/token-service');
  const { applyTokenRsvp } = await import('@/lib/rsvp/actions');
  const { eq } = await import('drizzle-orm');

  // ---- fixtures ----------------------------------------------------------------
  const [user] = await db
    .insert(schema.users)
    .values({ email: 'race@test.local', name: 'Race Tester' })
    .returning();

  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'race-event-1', ownerUserId: user.id, title: 'Race Event' })
    .returning();

  const [recipient] = await db
    .insert(schema.recipients)
    .values({ ownerUserId: user.id, email: 'racer@test.local', displayName: 'Racer' })
    .returning();

  await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: recipient.id });

  const token = signToken({ rid: recipient.id, eid: event.id, act: 'rsvp.in', ttlSec: 3600 });

  // ---- fire both calls simultaneously ------------------------------------------
  // PGlite is single-threaded, so "concurrent" here means both Promises are
  // enqueued before either resolves — they still race through the INSERT before
  // the other's .returning() is checked, reproducing the original bug.
  const [res1, res2] = await Promise.all([
    applyTokenRsvp(token),
    applyTokenRsvp(token),
  ]);

  // Both calls must succeed.
  assert.equal(res1.ok, true, `res1 should be ok, got: ${JSON.stringify(res1)}`);
  assert.equal(res2.ok, true, `res2 should be ok, got: ${JSON.stringify(res2)}`);

  // Exactly one call must be the first consumer; the other must be the replay.
  const consumedFalseCount = [res1, res2].filter(
    (r) => r.ok && r.alreadyConsumed === false,
  ).length;
  const consumedTrueCount = [res1, res2].filter(
    (r) => r.ok && r.alreadyConsumed === true,
  ).length;

  assert.equal(consumedFalseCount, 1, `exactly 1 call should have alreadyConsumed=false, got ${consumedFalseCount}`);
  assert.equal(consumedTrueCount, 1, `exactly 1 call should have alreadyConsumed=true, got ${consumedTrueCount}`);
  console.log('OK: one call consumed, one replay');

  // evaluateEventConditions side-effects should fire exactly once — confirmed by
  // checking that there is exactly one email_tokens row for this (recipient, event, action).
  const tokenRows = await db
    .select()
    .from(schema.emailTokens)
    .where(
      eq(schema.emailTokens.recipientId, recipient.id),
    );
  const matchingRows = tokenRows.filter(
    (r) => r.eventId === event.id && r.action === 'rsvp.in',
  );
  assert.equal(matchingRows.length, 1, `expected exactly 1 email_tokens row, got ${matchingRows.length}`);
  console.log('OK: exactly one email_tokens consumption row — no duplicate side-effects');

  // Both results should report status 'going' (the action's intended outcome).
  if (res1.ok) assert.equal(res1.status, 'going');
  if (res2.ok) assert.equal(res2.status, 'going');
  console.log('OK: both results carry status=going');

  console.log('All rsvp-race unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
