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

async function main() {
  const { db, ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();
  const schema = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { dispatchOverdueReminders } = await import('@/lib/notifications/reminders');

  // Setup: buyer, event, 2 pledgers, purchase 4 days ago.
  const [buyer] = await db.insert(schema.users).values({ email: 'buyer@test', name: 'Buyer' }).returning();
  const [event] = await db.insert(schema.events).values({ slug: 'rem-1', ownerUserId: buyer.id, title: 'Remind test' }).returning();
  const [r1] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'a@t', displayName: 'A' }).returning();
  const [r2] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'b@t', displayName: 'B' }).returning();
  const [i1] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r1.id }).returning();
  const [i2] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r2.id }).returning();
  await db.insert(schema.rsvps).values({ eventInviteId: i1.id, status: 'going', pledgeState: 'locked' });
  await db.insert(schema.rsvps).values({ eventInviteId: i2.id, status: 'going', pledgeState: 'locked' });

  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const [purchase] = await db
    .insert(schema.purchases)
    .values({ eventId: event.id, buyerUserId: buyer.id, totalCents: 8000, ticketCount: 2, createdAt: fourDaysAgo })
    .returning();
  await db.insert(schema.owed).values([
    { purchaseId: purchase.id, eventInviteId: i1.id, amountCents: 4000 },
    { purchaseId: purchase.id, eventInviteId: i2.id, amountCents: 4000 },
  ]);

  // First dispatch — both should be reminded.
  const r = await dispatchOverdueReminders();
  assert.equal(r.sent, 2, `first run should send 2, got ${r.sent}`);
  assert.equal(outboxCount(), 2);
  console.log('OK: first run reminds both');

  // Second dispatch immediately after — both should be skipped (rate-limit).
  const r2nd = await dispatchOverdueReminders();
  assert.equal(r2nd.sent, 0);
  assert.equal(r2nd.skipped, 2);
  console.log('OK: same-window second run skips both');

  // Mark one as paid — only the unpaid one should get future reminders.
  await db.update(schema.owed).set({ paid: 1, paidAt: new Date() }).where(eq(schema.owed.eventInviteId, i1.id));
  // Force the unpaid row's lastRemindedAt back into the past so it's eligible.
  await db.update(schema.owed).set({ lastRemindedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }).where(eq(schema.owed.eventInviteId, i2.id));
  const r3rd = await dispatchOverdueReminders();
  assert.equal(r3rd.sent, 1, `third run should send 1 (only unpaid), got ${r3rd.sent}`);
  console.log('OK: paid row is excluded, unpaid row reminded again');

  // Less-than-24h purchase: should not remind.
  const [event2] = await db.insert(schema.events).values({ slug: 'rem-2', ownerUserId: buyer.id, title: 'Fresh test' }).returning();
  const [r3] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'c@t', displayName: 'C' }).returning();
  const [i3] = await db.insert(schema.eventInvites).values({ eventId: event2.id, recipientId: r3.id }).returning();
  await db.insert(schema.rsvps).values({ eventInviteId: i3.id, status: 'going', pledgeState: 'locked' });
  const [p2] = await db.insert(schema.purchases).values({ eventId: event2.id, buyerUserId: buyer.id, totalCents: 5000, ticketCount: 1 }).returning();
  await db.insert(schema.owed).values({ purchaseId: p2.id, eventInviteId: i3.id, amountCents: 5000 });

  const before = outboxCount();
  const r4th = await dispatchOverdueReminders();
  assert.equal(outboxCount(), before + (r4th.sent), 'outbox count matches sent');
  // The fresh purchase row should be skipped (<24h), but the older unpaid one might still be inside its rate-limit window.
  // Verify no email was generated for r3 specifically.
  const r3Files = readdirSync(OUTBOX).map((f) => f).filter((f) => f.endsWith('.json'));
  const recentR3 = r3Files.filter((f) => {
    const json = JSON.parse(readFileSync(join(OUTBOX, f), 'utf8'));
    return json.to === 'c@t';
  });
  assert.equal(recentR3.length, 0, 'no reminder for fresh purchase');
  console.log('OK: <24h-old purchase not reminded');

  console.log('All reminder unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
