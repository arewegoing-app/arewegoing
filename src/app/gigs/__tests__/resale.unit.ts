import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
const OUTBOX = join(process.cwd(), '.gigs-outbox');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
if (existsSync(OUTBOX)) rmSync(OUTBOX, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const outboxToRecipient = (email: string): boolean => {
  if (!existsSync(OUTBOX)) return false;
  return readdirSync(OUTBOX).some((f) => {
    const j = JSON.parse(readFileSync(join(OUTBOX, f), 'utf8'));
    return j.to === email && /up for grabs|Take the ticket/i.test(j.text);
  });
};

async function main() {
  const { db, ensureMigrated } = await import('../lib/db/client');
  await ensureMigrated();
  const schema = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { signToken } = await import('../lib/tokens/token-service');
  const { requestBail, applyResaleClaimToken, expireStaleListings } = await import('../lib/rsvp/resale');

  const [buyer] = await db.insert(schema.users).values({ email: 'buyer@t', name: 'Buyer' }).returning();
  const [event] = await db.insert(schema.events).values({ slug: 'resale-1', ownerUserId: buyer.id, title: 'Resale test' }).returning();

  // 3 pledgers (locked) + 1 outsider (going but never pledged).
  const ppl: Array<{ rid: string; iid: string; email: string }> = [];
  for (const e of ['p1@t', 'p2@t', 'p3@t', 'out@t']) {
    const [r] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: e, displayName: e.split('@')[0] }).returning();
    const [i] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r.id }).returning();
    ppl.push({ rid: r.id, iid: i.id, email: e });
  }
  // p1, p2, p3 locked. out is plain going.
  for (let k = 0; k < 3; k++) {
    await db.insert(schema.rsvps).values({ eventInviteId: ppl[k].iid, status: 'going', pledgeState: 'locked' });
  }
  await db.insert(schema.rsvps).values({ eventInviteId: ppl[3].iid, status: 'going', pledgeState: 'none' });

  const [purchase] = await db
    .insert(schema.purchases)
    .values({ eventId: event.id, buyerUserId: buyer.id, totalCents: 12_000, ticketCount: 3 })
    .returning();
  await db.insert(schema.owed).values([
    { purchaseId: purchase.id, eventInviteId: ppl[0].iid, amountCents: 4000 },
    { purchaseId: purchase.id, eventInviteId: ppl[1].iid, amountCents: 4000 },
    { purchaseId: purchase.id, eventInviteId: ppl[2].iid, amountCents: 4000 },
  ]);

  // p1 bails
  const bail = await requestBail({ inviteId: ppl[0].iid, reason: 'sick' });
  assert.equal(bail.ok, true);
  if (bail.ok) {
    // p2, p3 are locked → excluded. out is not pledged → eligible.
    assert.equal(bail.offered, 1, `expected 1 offer, got ${bail.offered}`);
    assert.equal(bail.alreadyOpen, false);
  }
  console.log('OK: bail opens listing, offers only to non-locked recipients');

  assert.ok(outboxToRecipient('out@t'), 'outsider got resale email');
  assert.ok(!outboxToRecipient('p2@t'), 'p2 (locked) did not get resale email');
  assert.ok(!outboxToRecipient('p3@t'), 'p3 (locked) did not get resale email');
  console.log('OK: emails routed only to eligible recipients');

  // p1's rsvp should be bailed
  const [p1Rsvp] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, ppl[0].iid));
  assert.equal(p1Rsvp.pledgeState, 'bailed');
  console.log('OK: bailer flagged as bailed');

  // Re-requesting bail: idempotent (alreadyOpen=true)
  const bail2 = await requestBail({ inviteId: ppl[0].iid });
  assert.equal(bail2.ok, true);
  if (bail2.ok) assert.equal(bail2.alreadyOpen, true);
  console.log('OK: re-bail is idempotent');

  // out claims the listing via token
  const claimTok = signToken({ rid: ppl[3].rid, eid: event.id, act: 'bail.claim', ttlSec: 3600 });
  const claim = await applyResaleClaimToken(claimTok);
  assert.equal(claim.ok, true);
  if (claim.ok) {
    assert.equal(claim.eventSlug, 'resale-1');
    assert.equal(claim.alreadyClaimed, false);
  }
  console.log('OK: outsider claims listing');

  // owed row should now point to outsider
  const owedRows = await db.select().from(schema.owed).where(eq(schema.owed.purchaseId, purchase.id));
  const outOwed = owedRows.find((o) => o.eventInviteId === ppl[3].iid);
  const p1Owed = owedRows.find((o) => o.eventInviteId === ppl[0].iid);
  assert.ok(outOwed, 'outsider has an owed row');
  assert.equal(p1Owed, undefined, 'p1 no longer has an owed row');
  console.log('OK: owed row repoints to claimer');

  // out should now be locked, p1 should be replaced
  const [outRsvp] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, ppl[3].iid));
  assert.equal(outRsvp.pledgeState, 'locked');
  const [p1After] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, ppl[0].iid));
  assert.equal(p1After.pledgeState, 'replaced');
  console.log('OK: claimer locked, original marked replaced');

  // Second claim attempt is a no-op (already claimed)
  const claim2 = await applyResaleClaimToken(claimTok);
  assert.equal(claim2.ok, true);
  if (claim2.ok) assert.equal(claim2.alreadyClaimed, true);
  console.log('OK: replay claim returns alreadyClaimed');

  // Expiry path: create another listing and force it past its deadline.
  const [event2] = await db.insert(schema.events).values({ slug: 'resale-2', ownerUserId: buyer.id, title: 'Expire test' }).returning();
  const [r] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'lonely@t', displayName: 'Lonely' }).returning();
  const [i] = await db.insert(schema.eventInvites).values({ eventId: event2.id, recipientId: r.id }).returning();
  await db.insert(schema.rsvps).values({ eventInviteId: i.id, status: 'going', pledgeState: 'locked' });
  const [p2] = await db.insert(schema.purchases).values({ eventId: event2.id, buyerUserId: buyer.id, totalCents: 4000, ticketCount: 1 }).returning();
  await db.insert(schema.owed).values({ purchaseId: p2.id, eventInviteId: i.id, amountCents: 4000 });

  await requestBail({ inviteId: i.id });
  await db.update(schema.resaleListings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.resaleListings.eventId, event2.id));
  const expired = await expireStaleListings();
  assert.equal(expired.expired, 1);
  console.log('OK: stale listings auto-expire');

  console.log('All resale unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
