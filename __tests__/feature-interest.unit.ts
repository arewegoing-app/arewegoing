// Unit test for the features-v2 intent log.
// Mirrors the setup in series.unit.ts: PGlite on disk, no email side-effects.

import { strict as assert } from 'node:assert';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.GIGS_TOKEN_SECRET = 'unit-test-secret';

const DATA_DIR = join(process.cwd(), '.gigs-data');
if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

async function main() {
  const { ensureMigrated } = await import('@/lib/db/client');
  await ensureMigrated();
  const { upsertFeatureInterest, countFeatureInterest } = await import('@/lib/feature_interest/store');

  // Anon tap on a feature: row created.
  const a1 = await upsertFeatureInterest({
    actor: { anonId: 'anon-aaa' },
    featureKey: 'connect.facebook',
  });
  assert.equal(a1.created, true);
  assert.equal(await countFeatureInterest('connect.facebook'), 1);
  console.log('OK: first anon tap creates a row');

  // Same anon taps again: same row, no duplicate.
  const a2 = await upsertFeatureInterest({
    actor: { anonId: 'anon-aaa' },
    featureKey: 'connect.facebook',
  });
  assert.equal(a2.created, false);
  assert.equal(a2.id, a1.id);
  assert.equal(await countFeatureInterest('connect.facebook'), 1);
  console.log('OK: same actor + feature dedupes');

  // Same anon adds an email later: row stays, email + notifyOptIn upserted.
  const a3 = await upsertFeatureInterest({
    actor: { anonId: 'anon-aaa' },
    featureKey: 'connect.facebook',
    email: 'oli@example.com',
    notifyOptIn: true,
  });
  assert.equal(a3.created, false);
  assert.equal(a3.id, a1.id);
  console.log('OK: late email + opt-in upserts in place');

  // Strongest-signal rule: a later tap without email must NOT blank the email.
  const a4 = await upsertFeatureInterest({
    actor: { anonId: 'anon-aaa' },
    featureKey: 'connect.facebook',
  });
  assert.equal(a4.id, a1.id);
  const { db } = await import('@/lib/db/client');
  const schema = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const [row] = await db
    .select()
    .from(schema.featureInterest)
    .where(eq(schema.featureInterest.id, a1.id));
  assert.equal(row.email, 'oli@example.com');
  assert.equal(row.notifyOptIn, 1);
  console.log('OK: later empty tap does not erase prior email / opt-in');

  // Different feature_key on same anon: new row.
  const b1 = await upsertFeatureInterest({
    actor: { anonId: 'anon-aaa' },
    featureKey: 'connect.songkick',
  });
  assert.equal(b1.created, true);
  assert.notEqual(b1.id, a1.id);
  console.log('OK: different feature is a separate row');

  // Different anon on same feature: another new row (multiple actors interested).
  const c1 = await upsertFeatureInterest({
    actor: { anonId: 'anon-bbb' },
    featureKey: 'connect.facebook',
  });
  assert.equal(c1.created, true);
  assert.equal(await countFeatureInterest('connect.facebook'), 2);
  console.log('OK: different actor is a separate row');

  // Signed-in user is a distinct actor from any anon id.
  const [user] = await db
    .insert(schema.users)
    .values({ email: 'someone@t', name: 'Someone' })
    .returning();
  const d1 = await upsertFeatureInterest({
    actor: { userId: user.id },
    featureKey: 'connect.facebook',
  });
  assert.equal(d1.created, true);
  assert.equal(await countFeatureInterest('connect.facebook'), 3);
  const d2 = await upsertFeatureInterest({
    actor: { userId: user.id },
    featureKey: 'connect.facebook',
    notifyOptIn: true,
  });
  assert.equal(d2.created, false);
  assert.equal(d2.id, d1.id);
  console.log('OK: signed-in user is a distinct actor; dedupes within actor');

  console.log('All feature-interest unit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
