/**
 * Stripe payment intent adapter.
 *
 * STRIPE_MODE=stub (default) — deterministic in-memory simulation.
 * STRIPE_MODE=live — delegates to the real `stripe` npm package using
 *   STRIPE_SECRET_KEY. The `stripe` package is NOT listed in package.json;
 *   if you flip live mode you must `pnpm add stripe` first.
 */

import { nanoid } from 'nanoid';

export type IntentState = 'requires_capture' | 'captured' | 'canceled';

export interface PaymentIntent {
  id: string;
  amountCents: number;
  state: IntentState;
}

export interface StripeAdapter {
  createIntent(opts: { amountCents: number; idempotencyKey: string }): Promise<PaymentIntent>;
  captureIntent(id: string): Promise<PaymentIntent>;
  releaseIntent(id: string): Promise<PaymentIntent>;
}

// ---------------------------------------------------------------------------
// Stub adapter — no network calls, state survives for the lifetime of the
// Node process (sufficient for unit tests; resets on cold start in prod).
// ---------------------------------------------------------------------------

const stubStore = new Map<string, PaymentIntent>();

const stubAdapter: StripeAdapter = {
  async createIntent({ amountCents, idempotencyKey }) {
    // Idempotency: same key returns the same PI.
    for (const pi of stubStore.values()) {
      if (pi.id.endsWith(idempotencyKey.slice(-8))) return pi;
    }
    const id = `pi_stub_${nanoid(12)}`;
    const pi: PaymentIntent = { id, amountCents, state: 'requires_capture' };
    stubStore.set(id, pi);
    return pi;
  },
  async captureIntent(id) {
    const pi = stubStore.get(id);
    if (!pi) throw new Error(`stub: unknown intent ${id}`);
    if (pi.state !== 'requires_capture') throw new Error(`stub: cannot capture intent in state ${pi.state}`);
    pi.state = 'captured';
    return pi;
  },
  async releaseIntent(id) {
    const pi = stubStore.get(id);
    if (!pi) throw new Error(`stub: unknown intent ${id}`);
    if (pi.state !== 'requires_capture') throw new Error(`stub: cannot cancel intent in state ${pi.state}`);
    pi.state = 'canceled';
    return pi;
  },
};

// ---------------------------------------------------------------------------
// Live adapter — thin wrapper around the real Stripe SDK.
// Only instantiated when STRIPE_MODE=live AND STRIPE_SECRET_KEY is set.
// ---------------------------------------------------------------------------

async function makeLiveAdapter(): Promise<StripeAdapter> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required for live mode');

  // Use new Function to prevent Next.js bundler from statically resolving
  // the 'stripe' specifier (the package is an optional peer dep, not installed
  // in this repo unless STRIPE_MODE=live is explicitly configured).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- optional peer dep
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { default: Stripe } = await dynamicImport('stripe');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const stripe = new Stripe(key, { apiVersion: '2024-04-10' });

  return {
    async createIntent({ amountCents, idempotencyKey }) {
      const pi = await stripe.paymentIntents.create(
        { amount: amountCents, currency: 'nzd', capture_method: 'manual' },
        { idempotencyKey },
      );
      return { id: pi.id, amountCents: pi.amount, state: 'requires_capture' };
    },
    async captureIntent(id) {
      const pi = await stripe.paymentIntents.capture(id);
      return { id: pi.id, amountCents: pi.amount, state: 'captured' };
    },
    async releaseIntent(id) {
      const pi = await stripe.paymentIntents.cancel(id);
      return { id: pi.id, amountCents: pi.amount, state: 'canceled' };
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level singleton: resolve once per process.
// ---------------------------------------------------------------------------

let _adapter: StripeAdapter | null = null;

export async function getStripeAdapter(): Promise<StripeAdapter> {
  if (_adapter) return _adapter;
  const mode = process.env.STRIPE_MODE ?? 'stub';
  if (mode === 'live') {
    _adapter = await makeLiveAdapter();
  } else {
    _adapter = stubAdapter;
  }
  return _adapter;
}

/** Reset the stub store + adapter singleton. Only for testing. */
export function _resetStub(): void {
  stubStore.clear();
  _adapter = null;
}
