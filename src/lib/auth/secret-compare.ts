import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time equality check for header-supplied bearer secrets.
 *
 * `timingSafeEqual` throws when the buffer lengths differ, so we
 * compare lengths first and bail fast. The function never throws on
 * mismatched input; it just returns false.
 */
export function safeEqualSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
