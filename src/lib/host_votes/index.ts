'use server';

import { z } from 'zod';
import { auth } from '../auth/auth';
import { getOrSetAnonId } from '../anon/identity';
import { castHostVote, type Actor, type HostKind } from './store';

const inputSchema = z.object({
  eventId: z.string().min(1),
  kind: z.enum(['predrinks', 'afters']),
  candidateLabel: z.string().min(1).max(120),
});
export type VoteForHostInput = z.input<typeof inputSchema>;

export async function voteForHost(input: VoteForHostInput) {
  const parsed = inputSchema.parse(input);
  const session = await auth();
  const actor: Actor = session?.user?.id
    ? { userId: session.user.id }
    : { anonId: await getOrSetAnonId() };
  const result = await castHostVote({
    actor,
    eventId: parsed.eventId,
    kind: parsed.kind as HostKind,
    candidateLabel: parsed.candidateLabel.trim(),
  });
  return { ok: true as const, switched: result.switched };
}
