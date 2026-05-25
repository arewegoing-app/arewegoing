import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  const { db, ensureMigrated } = await import('../lib/db/client');
  await ensureMigrated();

  const schema = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { getReliabilityStats } = await import('../lib/memory/stats');

  // ── Seed ────────────────────────────────────────────────────────────────────
  const [buyer] = await db
    .insert(schema.users)
    .values({ email: 'buyer@memory.test', name: 'Buyer' })
    .returning();

  const [rA] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'a@memory.test', displayName: 'Alice' }).returning();
  const [rB] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'b@memory.test', displayName: 'Bob' }).returning();
  const [rC] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'c@memory.test', displayName: 'Carol' }).returning();

  // Two events owned by the buyer.
  const [ev1] = await db.insert(schema.events).values({ slug: 'mem-ev1', ownerUserId: buyer.id, title: 'Memory Event 1' }).returning();
  const [ev2] = await db.insert(schema.events).values({ slug: 'mem-ev2', ownerUserId: buyer.id, title: 'Memory Event 2' }).returning();

  // ── Event 1: Alice confirms + pays; Bob confirms + pays ──────────────────────
  const [iA1] = await db.insert(schema.eventInvites).values({ eventId: ev1.id, recipientId: rA.id }).returning();
  const [iB1] = await db.insert(schema.eventInvites).values({ eventId: ev1.id, recipientId: rB.id }).returning();

  // Buyer purchases for event 1.
  const [pur1] = await db
    .insert(schema.purchases)
    .values({ eventId: ev1.id, buyerUserId: buyer.id, totalCents: 8000, ticketCount: 2 })
    .returning();

  // Final call for event 1.
  const [fc1] = await db
    .insert(schema.finalCalls)
    .values({ eventId: ev1.id, triggeredByUserId: buyer.id, deadlineAt: new Date(Date.now() + 3_600_000), pledgeAmount: 40 })
    .returning();

  // Alice: pledge confirmed + locked + paid on event 1.
  await db.insert(schema.rsvps).values({ eventInviteId: iA1.id, status: 'going', pledgeState: 'locked', lockedAt: new Date() });
  await db.insert(schema.pledgeCommitments).values({ finalCallId: fc1.id, eventInviteId: iA1.id, state: 'confirmed' });
  const now = Date.now();
  const payDayA1 = new Date(now - 1_000); // paid ~0 days after purchase
  await db.insert(schema.owed).values({ purchaseId: pur1.id, eventInviteId: iA1.id, amountCents: 4000, paid: 1, paidAt: payDayA1 });

  // Bob: pledge confirmed + paid on event 1.
  await db.insert(schema.rsvps).values({ eventInviteId: iB1.id, status: 'going', pledgeState: 'locked', lockedAt: new Date() });
  await db.insert(schema.pledgeCommitments).values({ finalCallId: fc1.id, eventInviteId: iB1.id, state: 'confirmed' });
  const payDayB1 = new Date(now - 1_000);
  await db.insert(schema.owed).values({ purchaseId: pur1.id, eventInviteId: iB1.id, amountCents: 4000, paid: 1, paidAt: payDayB1 });

  // ── Event 2: Alice confirms + pays; Bob drops; Carol confirms + locked but unpaid ──
  const [iA2] = await db.insert(schema.eventInvites).values({ eventId: ev2.id, recipientId: rA.id }).returning();
  const [iB2] = await db.insert(schema.eventInvites).values({ eventId: ev2.id, recipientId: rB.id }).returning();
  const [iC2] = await db.insert(schema.eventInvites).values({ eventId: ev2.id, recipientId: rC.id }).returning();

  const [pur2] = await db
    .insert(schema.purchases)
    .values({ eventId: ev2.id, buyerUserId: buyer.id, totalCents: 12000, ticketCount: 3 })
    .returning();

  const [fc2] = await db
    .insert(schema.finalCalls)
    .values({ eventId: ev2.id, triggeredByUserId: buyer.id, deadlineAt: new Date(Date.now() + 3_600_000), pledgeAmount: 40 })
    .returning();

  // Alice: confirmed + paid on event 2 (5 days after purchase to test avg).
  await db.insert(schema.rsvps).values({ eventInviteId: iA2.id, status: 'going', pledgeState: 'locked', lockedAt: new Date() });
  await db.insert(schema.pledgeCommitments).values({ finalCallId: fc2.id, eventInviteId: iA2.id, state: 'confirmed' });
  // purchase.createdAt is defaultNow() — approximate with `now`. paidAt = now + 5 days.
  const payDayA2 = new Date(now + 5 * 86_400_000);
  await db.insert(schema.owed).values({ purchaseId: pur2.id, eventInviteId: iA2.id, amountCents: 4000, paid: 1, paidAt: payDayA2 });

  // Bob: dropped on event 2.
  await db.insert(schema.rsvps).values({ eventInviteId: iB2.id, status: 'maybe', pledgeState: 'none' });
  await db.insert(schema.pledgeCommitments).values({ finalCallId: fc2.id, eventInviteId: iB2.id, state: 'dropped' });
  await db.insert(schema.owed).values({ purchaseId: pur2.id, eventInviteId: iB2.id, amountCents: 4000, paid: 0 });

  // Carol: confirmed + locked but NOT paid. Purchase was 5 days ago (simulate via paidAt logic).
  await db.insert(schema.rsvps).values({ eventInviteId: iC2.id, status: 'going', pledgeState: 'locked', lockedAt: new Date() });
  await db.insert(schema.pledgeCommitments).values({ finalCallId: fc2.id, eventInviteId: iC2.id, state: 'confirmed' });
  await db.insert(schema.owed).values({ purchaseId: pur2.id, eventInviteId: iC2.id, amountCents: 4000, paid: 0 });

  // ── Query ────────────────────────────────────────────────────────────────────
  const stats = await getReliabilityStats(
    { buyerUserId: buyer.id },
    [rA.id, rB.id, rC.id],
  );

  // ── Alice assertions ─────────────────────────────────────────────────────────
  // 2 events: both pledges confirmed, both paid, no bails.
  const sA = stats.get(rA.id)!;
  assert.ok(sA, 'Alice stats should exist');
  assert.equal(sA.pledgedConfirmed, 2, `Alice pledgedConfirmed: expected 2, got ${sA.pledgedConfirmed}`);
  assert.equal(sA.pledgedDropped, 0, `Alice pledgedDropped: expected 0, got ${sA.pledgedDropped}`);
  assert.equal(sA.paid, 2, `Alice paid: expected 2, got ${sA.paid}`);
  assert.equal(sA.unpaid, 0, `Alice unpaid: expected 0, got ${sA.unpaid}`);
  assert.equal(sA.bails, 0, `Alice bails: expected 0, got ${sA.bails}`);
  // avgDaysToPay: event1 paidAt ≈ now (so ≈ 0 days), event2 paidAt = now+5d.
  // purchase.createdAt is ~now in both cases. Average ≈ 2.5 days.
  assert.ok(sA.avgDaysToPay !== null, 'Alice avgDaysToPay should not be null');
  assert.ok(sA.avgDaysToPay! >= 0, 'Alice avgDaysToPay should be >= 0');
  console.log(`OK: Alice — confirmed=${sA.pledgedConfirmed} paid=${sA.paid} bails=${sA.bails} avgDays=${sA.avgDaysToPay?.toFixed(2)}`);

  // ── Bob assertions ───────────────────────────────────────────────────────────
  // Event 1: confirmed + paid. Event 2: dropped + unpaid bail.
  const sB = stats.get(rB.id)!;
  assert.ok(sB, 'Bob stats should exist');
  assert.equal(sB.pledgedConfirmed, 1, `Bob pledgedConfirmed: expected 1, got ${sB.pledgedConfirmed}`);
  assert.equal(sB.pledgedDropped, 1, `Bob pledgedDropped: expected 1, got ${sB.pledgedDropped}`);
  assert.equal(sB.paid, 1, `Bob paid: expected 1, got ${sB.paid}`);
  assert.equal(sB.unpaid, 1, `Bob unpaid: expected 1, got ${sB.unpaid}`);
  assert.equal(sB.bails, 1, `Bob bails: expected 1, got ${sB.bails}`);
  console.log(`OK: Bob — confirmed=${sB.pledgedConfirmed} dropped=${sB.pledgedDropped} paid=${sB.paid} unpaid=${sB.unpaid} bails=${sB.bails}`);

  // ── Carol assertions ──────────────────────────────────────────────────────────
  // Event 2 only: confirmed + locked + unpaid.
  const sC = stats.get(rC.id)!;
  assert.ok(sC, 'Carol stats should exist');
  assert.equal(sC.pledgedConfirmed, 1, `Carol pledgedConfirmed: expected 1, got ${sC.pledgedConfirmed}`);
  assert.equal(sC.locked, 1, `Carol locked: expected 1, got ${sC.locked}`);
  assert.equal(sC.paid, 0, `Carol paid: expected 0, got ${sC.paid}`);
  assert.equal(sC.unpaid, 1, `Carol unpaid: expected 1, got ${sC.unpaid}`);
  assert.equal(sC.bails, 0, `Carol bails: expected 0, got ${sC.bails}`);
  assert.equal(sC.avgDaysToPay, null, 'Carol avgDaysToPay should be null (no paid rows)');
  console.log(`OK: Carol — confirmed=${sC.pledgedConfirmed} locked=${sC.locked} unpaid=${sC.unpaid} avgDays=${sC.avgDaysToPay}`);

  console.log('All memory unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
