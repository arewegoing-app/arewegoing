/**
 * Single source of truth for "are we in production right now?".
 *
 * Vercel sets `NODE_ENV=production` for BOTH preview and production
 * deployments. `VERCEL_ENV` is what actually distinguishes them
 * (`preview` vs `production`). Either signal alone is insufficient
 * to decide whether to open dev-only escape hatches.
 *
 * Used by:
 *  - the inbound email webhook (gates the INBOUND_AUTH_OFF=1 bypass)
 *  - the cron auth helper (requires CRON_SECRET in prod, not in dev)
 *  - anywhere else that needs "this is a real-traffic deployment".
 *
 * Read at call time, not module load, so test helpers can swap envs.
 */
export function isProductionEnv(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}
