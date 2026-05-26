import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// Lazy: read on first use so `next build`'s page-data collection (which
// runs with NODE_ENV=production but no runtime env vars) doesn't crash.
let cachedSecret: string | undefined;
function getSecret(): string {
  if (cachedSecret !== undefined) return cachedSecret;
  const raw = process.env.GIGS_TOKEN_SECRET;
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('GIGS_TOKEN_SECRET must be set in production');
  }
  cachedSecret = raw ?? 'dev-only-secret-do-not-use-in-prod';
  return cachedSecret;
}

export const tokenPayloadSchema = z.object({
  rid: z.string().min(1),
  eid: z.string().min(1),
  act: z.enum([
    'rsvp.in', 'rsvp.maybe', 'rsvp.out',
    'rsvp.respond',
    'pledge.confirm', 'pledge.drop',
    'react.interested', 'react.down', 'react.cant', 'react.pledge_1', 'react.pledge_2', 'react.have_ticket',
    'bail.request', 'bail.claim',
    'feedback.submit',
    'view',
  ]),
  exp: z.number().int(),
  // Optional listing id, bound at issue time for bail.claim tokens so a
  // claim link maps to a specific resale row rather than "any open listing".
  lid: z.string().min(1).optional(),
});

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

function b64url(b: Buffer): string {
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', getSecret()).update(payload).digest());
}

/**
 * Issue a signed token for a single recipient action on a single event.
 *
 * `ttlSec` is in **seconds** (not milliseconds). The expiry is stamped as a
 * Unix epoch integer (`exp`) so the format stays URL-safe without a date
 * library on decode.
 *
 * The HMAC secret is loaded lazily on first call. In production the process
 * throws immediately if `GIGS_TOKEN_SECRET` is unset — fail-fast rather than
 * silently issuing tokens under a dev default.
 */
export function signToken(payload: Omit<TokenPayload, 'exp'> & { ttlSec: number }): string {
  const exp = Math.floor(Date.now() / 1000) + payload.ttlSec;
  const body: TokenPayload = { rid: payload.rid, eid: payload.eid, act: payload.act, exp };
  if (payload.lid) body.lid = payload.lid;
  const encoded = b64url(Buffer.from(JSON.stringify(body)));
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Discriminated union returned by {@link verifyToken}.
 *
 * Failure reasons:
 * - `malformed` — token is not `<body>.<sig>` (wrong number of dots).
 * - `invalid_signature` — HMAC mismatch; compared via `timingSafeEqual` to
 *   prevent timing-based forgery detection.
 * - `expired` — signature is valid but `exp` is in the past.
 * - `payload` — body decodes but fails Zod validation (unknown action, missing
 *   field, etc.).
 */
export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'malformed' | 'invalid_signature' | 'expired' | 'payload' };

/**
 * Verify a token produced by {@link signToken}.
 *
 * Signature comparison uses `timingSafeEqual` — constant-time regardless of
 * where the strings diverge, so an attacker cannot learn the secret by
 * measuring response latency.
 *
 * Returns `{ ok: true, payload }` only when the signature is valid AND the
 * token has not expired. All other outcomes return `{ ok: false, reason }`;
 * see {@link VerifyResult} for the full failure taxonomy.
 */
export function verifyToken(token: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'invalid_signature' };
  let parsed: unknown;
  try { parsed = JSON.parse(fromB64url(body).toString('utf8')); } catch { return { ok: false, reason: 'payload' }; }
  const v = tokenPayloadSchema.safeParse(parsed);
  if (!v.success) return { ok: false, reason: 'payload' };
  if (v.data.exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, payload: v.data };
}
