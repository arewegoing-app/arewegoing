import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const SECRET = process.env.GIGS_TOKEN_SECRET ?? 'dev-only-secret-do-not-use-in-prod';

export const tokenPayloadSchema = z.object({
  rid: z.string().min(1),
  eid: z.string().min(1),
  act: z.enum([
    'rsvp.in', 'rsvp.maybe', 'rsvp.out',
    'rsvp.respond',
    'pledge.confirm', 'pledge.drop',
    'react.interested', 'react.down', 'react.cant', 'react.pledge_1', 'react.pledge_2',
    'bail.request', 'bail.claim',
    'view',
  ]),
  exp: z.number().int(),
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
  return b64url(createHmac('sha256', SECRET).update(payload).digest());
}

export function signToken(payload: Omit<TokenPayload, 'exp'> & { ttlSec: number }): string {
  const exp = Math.floor(Date.now() / 1000) + payload.ttlSec;
  const body: TokenPayload = { rid: payload.rid, eid: payload.eid, act: payload.act, exp };
  const encoded = b64url(Buffer.from(JSON.stringify(body)));
  return `${encoded}.${sign(encoded)}`;
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'malformed' | 'invalid_signature' | 'expired' | 'payload' };

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
