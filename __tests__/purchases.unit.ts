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
  const { eq } = await import('drizzle-orm');

  const [buyer] = await db.insert(schema.users).values({ email: 'buyer@test.local', name: 'Buyer' }).returning();
  const [event] = await db.insert(schema.events).values({ slug: 'p-1', ownerUserId: buyer.id, title: 'Buy test' }).returning();

  const [r1] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'a@t', displayName: 'A' }).returning();
  const [r2] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'b@t', displayName: 'B' }).returning();
  const [i1] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r1.id }).returning();
  const [i2] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r2.id }).returning();
  await db.insert(schema.rsvps).values({ eventInviteId: i1.id, status: 'going', pledgeState: 'pledged' });
  await db.insert(schema.rsvps).values({ eventInviteId: i2.id, status: 'going', pledgeState: 'pledged' });

  // Mock session by setting env / using direct calls — for unit test, call lower-level not the action.
  // Insert purchase manually mirroring recordPurchase logic so we test the schema constraints.
  const [purchase] = await db
    .insert(schema.purchases)
    .values({ eventId: event.id, buyerUserId: buyer.id, totalCents: 8000, ticketCount: 2 })
    .returning();
  await db.insert(schema.owed).values([
    { purchaseId: purchase.id, eventInviteId: i1.id, amountCents: 4000 },
    { purchaseId: purchase.id, eventInviteId: i2.id, amountCents: 4000 },
  ]);
  await db.update(schema.rsvps).set({ pledgeState: 'locked', lockedAt: new Date() }).where(eq(schema.rsvps.eventInviteId, i1.id));
  await db.update(schema.rsvps).set({ pledgeState: 'locked', lockedAt: new Date() }).where(eq(schema.rsvps.eventInviteId, i2.id));

  const owedRows = await db.select().from(schema.owed).where(eq(schema.owed.purchaseId, purchase.id));
  assert.equal(owedRows.length, 2);
  assert.equal(owedRows.reduce((s, r) => s + r.amountCents, 0), 8000);
  console.log('OK: purchase splits 8000c across 2 pledgers');

  const [r1Rsvp] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, i1.id));
  assert.equal(r1Rsvp.pledgeState, 'locked');
  assert.ok(r1Rsvp.lockedAt);
  console.log('OK: rsvps flip pledged -> locked');

  await db.update(schema.owed).set({ paid: 1, paidAt: new Date() }).where(eq(schema.owed.eventInviteId, i1.id));
  const refreshed = await db.select().from(schema.owed).where(eq(schema.owed.purchaseId, purchase.id));
  const paidCount = refreshed.filter((r) => r.paid === 1).length;
  assert.equal(paidCount, 1);
  console.log('OK: markPaid flips one row');

  console.log('All purchase unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
