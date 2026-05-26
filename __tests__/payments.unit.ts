/**
 * Slice 7b — Deposit hold unit tests.
 *
 * Runs against an in-memory PGlite instance (stub Stripe mode).
 * Execute with: npx tsx src/app/gigs/__tests__/payments.unit.ts
 */

import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Env flags must be set before any module import.
process.env.GIGS_TOKEN_SECRET = 'unit-test-secret-payments';
process.env.STRIPE_MODE = 'stub';
process.env.DEPOSIT_AMOUNT_CENTS = '500';

// client.ts uses .gigs-data/ as its PGlite dir regardless of what we set
// locally, so we wipe THAT directory and ignore the historical
// .gigs-data-payments name. Matches the pattern used by every other
// shared-dir unit test.
const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  // Follow the same pattern as other unit tests: import client, ensureMigrated.
  // client.ts populates global.__gigsDb, which actions.ts then picks up.
  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();

  const schema = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { _resetStub } = await import('@/lib/payments/stripe-stub');
  const { holdDeposit, captureBail, releaseDeposit } = await import('@/lib/payments/actions');

  // -------------------------------------------------------------------------
  // Seed: buyer, event, final call, several invites.
  // -------------------------------------------------------------------------
  const [buyer] = await db
    .insert(schema.users)
    .values({ email: 'buyer@pay.local', name: 'Buyer' })
    .returning();

  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'pay-e2e', ownerUserId: buyer.id, title: 'Pay Test' })
    .returning();

  const mkRecipient = async (email: string, displayName: string) => {
    const [r] = await db
      .insert(schema.recipients)
      .values({ ownerUserId: buyer.id, email, displayName })
      .returning();
    const [i] = await db
      .insert(schema.eventInvites)
      .values({ eventId: event.id, recipientId: r.id })
      .returning();
    await db.insert(schema.rsvps).values({ eventInviteId: i.id, status: 'going' });
    return { recipientId: r.id, inviteId: i.id };
  };

  const p1 = await mkRecipient('pledger1@pay.local', 'Pledger1');
  const p2 = await mkRecipient('pledger2@pay.local', 'Pledger2');
  const p3 = await mkRecipient('pledger3@pay.local', 'Pledger3');

  const [call] = await db
    .insert(schema.finalCalls)
    .values({
      eventId: event.id,
      triggeredByUserId: buyer.id,
      deadlineAt: new Date(Date.now() + 60 * 60 * 1000),
      pledgeAmount: 40,
    })
    .returning();

  // =========================================================================
  // Test 1: confirm pledge → deposit hold row created, state='held'.
  // =========================================================================
  _resetStub();

  const hold1 = await holdDeposit({ eventInviteId: p1.inviteId, finalCallId: call.id, amountCents: 500 });
  assert.equal(hold1.ok, true, 'holdDeposit should succeed');
  if (!hold1.ok) throw new Error('unreachable');
  assert.equal(hold1.alreadyHeld, false, 'should not be a replay');

  const [row1] = await db
    .select()
    .from(schema.depositHolds)
    .where(eq(schema.depositHolds.id, hold1.holdId));
  assert.equal(row1.state, 'held', 'initial state must be held');
  assert.ok(row1.stripePaymentIntentId?.startsWith('pi_stub_'), 'PI id must be stub-prefixed');
  assert.equal(row1.amountCents, 500, 'amount must match');
  console.log('OK: Test 1 — pledge confirm → hold row state=held, stub PI present');

  // =========================================================================
  // Test 2: idempotency — confirming twice does not create a second hold.
  // =========================================================================
  const hold1b = await holdDeposit({ eventInviteId: p1.inviteId, finalCallId: call.id, amountCents: 500 });
  assert.equal(hold1b.ok, true, 'second holdDeposit should succeed');
  if (!hold1b.ok) throw new Error('unreachable');
  assert.equal(hold1b.alreadyHeld, true, 'second call must be flagged as replay');
  assert.equal(hold1b.holdId, hold1.holdId, 'must return the same hold id');

  const allHolds = await db
    .select()
    .from(schema.depositHolds)
    .where(eq(schema.depositHolds.eventInviteId, p1.inviteId));
  assert.equal(allHolds.length, 1, 'must not create a duplicate hold row');
  console.log('OK: Test 2 — idempotency: double-confirm does not double-hold');

  // =========================================================================
  // Test 3: bail + resale claim succeeds → state='released'.
  // =========================================================================
  _resetStub();

  const hold3 = await holdDeposit({ eventInviteId: p2.inviteId, finalCallId: call.id, amountCents: 500 });
  assert.equal(hold3.ok, true, 'holdDeposit for p2 should succeed');
  if (!hold3.ok) throw new Error('unreachable');

  const release3 = await releaseDeposit(p2.inviteId);
  assert.equal(release3.ok, true, 'releaseDeposit should succeed');
  if (!release3.ok) throw new Error('unreachable');
  assert.equal(release3.alreadyReleased, false, 'must not be flagged as already released');

  const [row3] = await db
    .select()
    .from(schema.depositHolds)
    .where(eq(schema.depositHolds.id, hold3.holdId));
  assert.equal(row3.state, 'released', 'hold must be released after claim');
  assert.ok(row3.releasedAt instanceof Date, 'releasedAt must be set');
  console.log('OK: Test 3 — bail + resale claim → hold state=released');

  // =========================================================================
  // Test 4: bail + resale expires unclaimed → state='captured'.
  // =========================================================================
  _resetStub();

  const hold4 = await holdDeposit({ eventInviteId: p3.inviteId, finalCallId: call.id, amountCents: 500 });
  assert.equal(hold4.ok, true, 'holdDeposit for p3 should succeed');
  if (!hold4.ok) throw new Error('unreachable');

  const capture4 = await captureBail(p3.inviteId);
  if (!capture4.ok) throw new Error(`captureBail failed: ${capture4.reason}`);
  assert.equal(capture4.ok, true, 'captureBail should succeed');
  assert.equal(capture4.alreadyCaptured, false, 'must not be flagged as already captured');

  const [row4] = await db
    .select()
    .from(schema.depositHolds)
    .where(eq(schema.depositHolds.id, hold4.holdId));
  assert.equal(row4.state, 'captured', 'hold must be captured after expiry');
  assert.ok(row4.capturedAt instanceof Date, 'capturedAt must be set');
  console.log('OK: Test 4 — bail + resale expires → hold state=captured');

  console.log('\nAll payment unit tests passed. (4 assertion groups)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
