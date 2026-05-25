// Owner check that works for signed-in users AND anonymous cookie owners.
// Keeps the MVP usable without forcing a signup.

import type { Event } from '../db/schema';
import { auth } from './auth';
import { readAnonId } from '../anon/identity';

export type OwnerCheck =
  | { isOwner: true; via: 'user' | 'anon'; userId?: string; anonId?: string }
  | { isOwner: false; reason: 'no_identity' | 'mismatch' };

export async function checkEventOwner(event: Pick<Event, 'ownerUserId' | 'anonOwnerId'>): Promise<OwnerCheck> {
  const session = await auth();
  if (session?.user?.id && event.ownerUserId === session.user.id) {
    return { isOwner: true, via: 'user', userId: session.user.id };
  }
  const anonId = await readAnonId();
  if (anonId && event.anonOwnerId === anonId) {
    return { isOwner: true, via: 'anon', anonId };
  }
  return { isOwner: false, reason: anonId || session?.user?.id ? 'mismatch' : 'no_identity' };
}
