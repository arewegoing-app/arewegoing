// Anonymous identity for the MVP — no signin needed for the calendar surface.
// Sets a cookie UUID on first visit. Reactions, comments, etc. are scoped to it.
// Auth (magic link / OTP) is intended later; this column intentionally lives
// next to user_id and recipient_id so the future migration is straightforward.

import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

const COOKIE_NAME = 'gigs_anon';
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getOrSetAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing && existing.length >= 8) return existing;
  const fresh = nanoid(21);
  // Server components can read but not always write — try-catch in case
  // a Next 16 component context doesn't allow set.
  try {
    store.set({
      name: COOKIE_NAME,
      value: fresh,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ONE_YEAR,
    });
  } catch {
    // Read-only context. Caller can fall back to passing the id via a route handler.
  }
  return fresh;
}

export async function readAnonId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}
