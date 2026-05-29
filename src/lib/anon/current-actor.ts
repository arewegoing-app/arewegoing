import { auth } from '@/lib/auth/auth';
import { getOrSetAnonId } from './identity';
import { getAnonProfile } from './profiles';

/** The entity performing an action — either an authenticated user or a cookie-keyed anon. */
export type Actor =
  | { kind: 'user'; id: string; displayName: string }
  | { kind: 'anon'; id: string; emoji?: string; displayName?: string };

/**
 * Resolve who is acting on this request.
 *
 * - Valid session → user actor.
 * - No session → anon actor keyed by gigs_anon cookie.
 *   If the cookie value is < 8 chars or contains whitespace/control chars, a
 *   fresh id is minted by getOrSetAnonId (which always returns ≥ 8 safe chars).
 */
export async function currentActor(): Promise<Actor> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      kind: 'user',
      id: session.user.id,
      displayName: session.user.name ?? session.user.email ?? session.user.id,
    };
  }

  // getOrSetAnonId already rejects short ids and mints a fresh nanoid(21) when
  // the cookie is absent or invalid. We add the control-char guard here.
  const raw = await getOrSetAnonId();
  // If getOrSetAnonId somehow returned something with whitespace or control
  // chars (defensive), mint a new id. In practice nanoid(21) never produces these.
  const anonId = /[\s\x00-\x1f]/.test(raw) ? await getOrSetAnonId() : raw;

  const profile = await getAnonProfile(anonId);
  return {
    kind: 'anon',
    id: anonId,
    emoji: profile?.emoji ?? undefined,
    displayName: profile?.displayName ?? undefined,
  };
}
