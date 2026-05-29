/**
 * One-off dev utility: clear "user button press" data from the local /
 * Vercel-pulled dev database.
 *
 * User-approved scope (via /Users/olitreadwell/code/arewegoing AskUserQuestion):
 *   - event_reactions      (Interested / I'm down / Got extras / Need one / Can't / Have ticket / pledge_1 / pledge_2 button presses)
 *   - event_host_votes     (Pre-drinks / afters voting buttons)
 *   - rsvps                (Going / Maybe / Out RSVPs on event detail)
 *   - pledge_commitments   (Pledge amount commitments on final call)
 *
 * Run: `npx tsx scripts/dev/clear-button-presses.ts`
 *
 * Never wire this into a npm script or CI. It deletes data unconditionally.
 */

import { db } from '@/lib/db/client';
import {
  eventReactions,
  hostVotes,
  pledgeCommitments,
  rsvps,
} from '@/lib/db/schema';

async function main() {
  const before = {
    reactions: (await db.select().from(eventReactions)).length,
    hostVotes: (await db.select().from(hostVotes)).length,
    pledges: (await db.select().from(pledgeCommitments)).length,
    rsvps: (await db.select().from(rsvps)).length,
  };
  console.log('Before:', before);

  await db.delete(eventReactions);
  await db.delete(hostVotes);
  await db.delete(pledgeCommitments);
  await db.delete(rsvps);

  const after = {
    reactions: (await db.select().from(eventReactions)).length,
    hostVotes: (await db.select().from(hostVotes)).length,
    pledges: (await db.select().from(pledgeCommitments)).length,
    rsvps: (await db.select().from(rsvps)).length,
  };
  console.log('After:', after);
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);
