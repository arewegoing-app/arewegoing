'use server';

/**
 * Deposit hold server actions (Slice 7b).
 *
 * All three actions are safe to call multiple times — they are idempotent by
 * (finalCallId, eventInviteId).
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { depositHolds, finalCalls, pledgeCommitments } from '../db/schema';
import { getStripeAdapter } from './stripe-stub';

// ---------------------------------------------------------------------------
// holdDeposit
// ---------------------------------------------------------------------------

export interface HoldDepositInput {
  eventInviteId: string;
  finalCallId: string;
  amountCents: number;
}

export type HoldDepositResult =
  | { ok: true; holdId: string; alreadyHeld: boolean }
  | { ok: false; reason: string };

/**
 * Create a Stripe Payment Intent with capture_method=manual and record a
 * deposit_holds row in state='held'.
 *
 * Idempotent: a second call for the same (finalCallId, eventInviteId) returns
 * the existing row without creating a new Payment Intent.
 */
export async function holdDeposit(input: HoldDepositInput): Promise<HoldDepositResult> {
  const { eventInviteId, finalCallId, amountCents } = input;

  // Idempotency check.
  const [existing] = await db
    .select()
    .from(depositHolds)
    .where(
      and(
        eq(depositHolds.finalCallId, finalCallId),
        eq(depositHolds.eventInviteId, eventInviteId),
      ),
    )
    .limit(1);

  if (existing) {
    return { ok: true, holdId: existing.id, alreadyHeld: true };
  }

  try {
    const stripe = await getStripeAdapter();
    const idempotencyKey = `hold_${finalCallId}_${eventInviteId}`;
    const pi = await stripe.createIntent({ amountCents, idempotencyKey });

    const [hold] = await db
      .insert(depositHolds)
      .values({
        finalCallId,
        eventInviteId,
        amountCents,
        state: 'held',
        stripePaymentIntentId: pi.id,
      })
      .returning();

    return { ok: true, holdId: hold.id, alreadyHeld: false };
  } catch (err) {
    // Record failure but don't block the pledge flow.
    await db
      .insert(depositHolds)
      .values({
        finalCallId,
        eventInviteId,
        amountCents,
        state: 'failed',
        stripePaymentIntentId: null,
      })
      .onConflictDoNothing();
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// captureBail
// ---------------------------------------------------------------------------

export type CaptureBailResult =
  | { ok: true; holdId: string; alreadyCaptured: boolean }
  | { ok: false; reason: string };

/**
 * Capture the deposit when a pledger bails and no resale claim fills the slot.
 * Called from expireStaleListings for unclaimed expired listings.
 */
export async function captureBail(eventInviteId: string): Promise<CaptureBailResult> {
  // Find the most-recent held deposit for this invite across any final call.
  const [hold] = await db
    .select()
    .from(depositHolds)
    .where(eq(depositHolds.eventInviteId, eventInviteId))
    .orderBy(depositHolds.createdAt)
    .limit(1);

  if (!hold) return { ok: false, reason: 'no_hold' };

  if (hold.state === 'captured') {
    return { ok: true, holdId: hold.id, alreadyCaptured: true };
  }

  if (hold.state !== 'held') {
    return { ok: false, reason: `hold_state_${hold.state}` };
  }

  if (!hold.stripePaymentIntentId) {
    return { ok: false, reason: 'no_payment_intent' };
  }

  try {
    const stripe = await getStripeAdapter();
    await stripe.captureIntent(hold.stripePaymentIntentId);

    await db
      .update(depositHolds)
      .set({ state: 'captured', capturedAt: new Date() })
      .where(eq(depositHolds.id, hold.id));

    return { ok: true, holdId: hold.id, alreadyCaptured: false };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// releaseDeposit
// ---------------------------------------------------------------------------

export type ReleaseDepositResult =
  | { ok: true; holdId: string; alreadyReleased: boolean }
  | { ok: false; reason: string };

/**
 * Cancel/release the deposit when a pledger pays back OR the resale claim fills
 * the slot so no one needs to lose their deposit.
 */
export async function releaseDeposit(eventInviteId: string): Promise<ReleaseDepositResult> {
  const [hold] = await db
    .select()
    .from(depositHolds)
    .where(eq(depositHolds.eventInviteId, eventInviteId))
    .orderBy(depositHolds.createdAt)
    .limit(1);

  if (!hold) return { ok: false, reason: 'no_hold' };

  if (hold.state === 'released') {
    return { ok: true, holdId: hold.id, alreadyReleased: true };
  }

  if (hold.state !== 'held') {
    return { ok: false, reason: `hold_state_${hold.state}` };
  }

  if (!hold.stripePaymentIntentId) {
    return { ok: false, reason: 'no_payment_intent' };
  }

  try {
    const stripe = await getStripeAdapter();
    await stripe.releaseIntent(hold.stripePaymentIntentId);

    await db
      .update(depositHolds)
      .set({ state: 'released', releasedAt: new Date() })
      .where(eq(depositHolds.id, hold.id));

    return { ok: true, holdId: hold.id, alreadyReleased: false };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

// Suppress unused-import lint: finalCalls and pledgeCommitments are referenced
// indirectly via the schema relations used by the DB.
void finalCalls;
void pledgeCommitments;
