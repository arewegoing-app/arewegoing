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
  const { signToken } = await import('../lib/tokens/token-service');
  const { applyPledgeToken, closeExpiredFinalCalls } = await import('../lib/rsvp/pledge');
  const { eq, sql } = await import('drizzle-orm');

  const [buyer] = await db
    .insert(schema.users)
    .values({ email: 'buyer@test.local', name: 'Buyer' })
    .returning();
  const [event] = await db
    .insert(schema.events)
    .values({ slug: 'pledge-e2e', ownerUserId: buyer.id, title: 'Pledge Test' })
    .returning();

  const [r1] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'a@test.local', displayName: 'A' }).returning();
  const [r2] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'b@test.local', displayName: 'B' }).returning();
  const [r3] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'c@test.local', displayName: 'C' }).returning();

  const [i1] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r1.id }).returning();
  const [i2] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r2.id }).returning();
  const [i3] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r3.id }).returning();
  await db.insert(schema.rsvps).values({ eventInviteId: i1.id, status: 'going' });
  await db.insert(schema.rsvps).values({ eventInviteId: i2.id, status: 'going' });
  await db.insert(schema.rsvps).values({ eventInviteId: i3.id, status: 'going' });

  const [call] = await db
    .insert(schema.finalCalls)
    .values({
      eventId: event.id,
      triggeredByUserId: buyer.id,
      deadlineAt: new Date(Date.now() + 60 * 60 * 1000),
      pledgeAmount: 40,
    })
    .returning();
  await db.insert(schema.pledgeCommitments).values([
    { finalCallId: call.id, eventInviteId: i1.id },
    { finalCallId: call.id, eventInviteId: i2.id },
    { finalCallId: call.id, eventInviteId: i3.id },
  ]);

  // r1 confirms
  const confirmTok = signToken({ rid: r1.id, eid: event.id, act: 'pledge.confirm', ttlSec: 3600 });
  const confirmRes = await applyPledgeToken(confirmTok);
  assert.equal(confirmRes.ok, true);
  if (confirmRes.ok) {
    assert.equal(confirmRes.action, 'confirmed');
    assert.equal(confirmRes.alreadyConsumed, false);
  }
  const [r1Rsvp] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, i1.id));
  assert.equal(r1Rsvp.pledgeState, 'pledged');
  assert.equal(r1Rsvp.pledgedAmount, 40);
  console.log('OK: r1 confirmed -> pledged');

  // r1 second click = replay
  const replay = await applyPledgeToken(confirmTok);
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.alreadyConsumed, true);
  console.log('OK: r1 replay = alreadyConsumed');

  // r2 drops
  const dropTok = signToken({ rid: r2.id, eid: event.id, act: 'pledge.drop', ttlSec: 3600 });
  const dropRes = await applyPledgeToken(dropTok);
  assert.equal(dropRes.ok, true);
  if (dropRes.ok) assert.equal(dropRes.action, 'dropped');
  const [r2Rsvp] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, i2.id));
  assert.equal(r2Rsvp.status, 'maybe');
  console.log('OK: r2 dropped -> maybe');

  // r3 doesn't respond. Force deadline past.
  await db.update(schema.finalCalls).set({ deadlineAt: new Date(Date.now() - 1000) }).where(eq(schema.finalCalls.id, call.id));
  const closed = await closeExpiredFinalCalls();
  assert.equal(closed.closed, 1);
  const [r3Rsvp] = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventInviteId, i3.id));
  assert.equal(r3Rsvp.status, 'maybe');
  console.log('OK: r3 silent -> maybe after close');

  // Final tally: 1 confirmed, 2 dropped
  const rows = await db.select().from(schema.pledgeCommitments).where(eq(schema.pledgeCommitments.finalCallId, call.id));
  const confirmed = rows.filter((r) => r.state === 'confirmed').length;
  const dropped = rows.filter((r) => r.state === 'dropped').length;
  assert.equal(confirmed, 1, `expected 1 confirmed, got ${confirmed}`);
  assert.equal(dropped, 2, `expected 2 dropped, got ${dropped}`);
  console.log('OK: tally = 1 confirmed, 2 dropped');

  // Reject a closed-call confirm
  const [r4Pre] = await db.insert(schema.recipients).values({ ownerUserId: buyer.id, email: 'd@test.local', displayName: 'D' }).returning();
  const [i4] = await db.insert(schema.eventInvites).values({ eventId: event.id, recipientId: r4Pre.id }).returning();
  await db.insert(schema.rsvps).values({ eventInviteId: i4.id, status: 'going' });
  const orphanTok = signToken({ rid: r4Pre.id, eid: event.id, act: 'pledge.confirm', ttlSec: 3600 });
  const orphan = await applyPledgeToken(orphanTok);
  assert.equal(orphan.ok, false);
  if (!orphan.ok) assert.equal(orphan.reason, 'no_active_call');
  console.log('OK: closed call rejects new pledge attempts');

  console.log('All pledge unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
