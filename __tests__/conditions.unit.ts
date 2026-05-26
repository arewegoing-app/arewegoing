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
  const { setRsvpConditions, evaluateEventConditions } = await import('@/lib/rsvp/conditions');

  const [buyer] = await db.insert(schema.users).values({ email: 'buyer@t', name: 'Buyer' }).returning();
  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'cond-1', ownerUserId: buyer.id, title: 'Condition test', priceLow: 30 })
    .returning();

  const ppl: Array<{ rid: string; iid: string }> = [];
  for (const e of ['a@t', 'b@t', 'c@t', 'd@t']) {
    const [r] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: e, displayName: e[0] }).returning();
    const [i] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r.id }).returning();
    ppl.push({ rid: r.id, iid: i.id });
  }
  const [A, B, C, D] = ppl;

  // A says "yes if 2 others go". Nobody else has RSVPd yet.
  await setRsvpConditions({ eventInviteId: A.iid, conditions: [{ kind: 'min_going', value: 2 }] });
  let aRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, A.iid)))[0];
  assert.equal(aRsvp.status, 'conditional');
  console.log('OK: A is conditional');

  // B says "going". A still conditional (only 1 going).
  await db.insert(schema.rsvps).values({ eventInviteId: B.iid, status: 'going' });
  await evaluateEventConditions(event.id);
  aRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, A.iid)))[0];
  assert.equal(aRsvp.status, 'conditional');
  console.log('OK: 1 going → A stays conditional');

  // C says "going". Now 2 others. A should auto-promote.
  await db.insert(schema.rsvps).values({ eventInviteId: C.iid, status: 'going' });
  const r1 = await evaluateEventConditions(event.id);
  assert.ok(r1.promoted >= 1, `expected at least 1 promoted, got ${r1.promoted}`);
  aRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, A.iid)))[0];
  assert.equal(aRsvp.status, 'going');
  console.log('OK: 2 others going → A auto-promoted to going');

  // B drops. Now A only has 1 other going. A should demote back.
  await db.update(schema.rsvps).set({ status: 'out' }).where(eq(schema.rsvps.eventInviteId, B.iid));
  const r2 = await evaluateEventConditions(event.id);
  assert.ok(r2.demoted >= 1, `expected at least 1 demoted, got ${r2.demoted}`);
  aRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, A.iid)))[0];
  assert.equal(aRsvp.status, 'conditional');
  console.log('OK: drop breaks threshold → A demoted back to conditional');

  // D says "yes if under $40". priceLow is 30 → satisfied immediately.
  await setRsvpConditions({ eventInviteId: D.iid, conditions: [{ kind: 'price_ceiling', value: 40 }] });
  await evaluateEventConditions(event.id);
  let dRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, D.iid)))[0];
  assert.equal(dRsvp.status, 'going');
  console.log('OK: price ceiling met → D promoted');

  // Bump price above ceiling. D should demote.
  await db.update(schema.events).set({ priceLow: 50 }).where(eq(schema.events.id, event.id));
  await evaluateEventConditions(event.id);
  dRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, D.iid)))[0];
  assert.equal(dRsvp.status, 'conditional');
  console.log('OK: price hike → D demoted back to conditional');

  // requires_promo: A also needs a promo code.
  await setRsvpConditions({
    eventInviteId: A.iid,
    conditions: [
      { kind: 'min_going', value: 1 },
      { kind: 'requires_promo', value: true },
    ],
  });
  await evaluateEventConditions(event.id);
  aRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, A.iid)))[0];
  // C is going (1 other) → min_going satisfied. But no promo → still conditional.
  assert.equal(aRsvp.status, 'conditional');
  console.log('OK: missing promo holds A as conditional');

  await db.insert(schema.promoOutreach).values({ eventId: event.id, status: 'got_code', code: 'FRIENDS20' });
  await evaluateEventConditions(event.id);
  aRsvp = (await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, A.iid)))[0];
  assert.equal(aRsvp.status, 'going');
  console.log('OK: promo arrives → A promoted (both conditions satisfied)');

  console.log('All condition unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
