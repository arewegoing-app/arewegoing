import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { log } from '../log';
import { eventFeedback, eventInvites, events, recipients, rsvps } from '../db/schema';
import { signToken } from '../tokens/token-service';
import { sendEmail } from './email';
import { postEventFeedbackEmail } from './templates-feedback';

const HOURS = (n: number): number => n * 60 * 60 * 1000;

/** TTL for feedback token links — 14 days. */
const FEEDBACK_TTL_SEC = 14 * 24 * 60 * 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

/** Build a signed redirect URL for a specific rating (0 = didn't attend). */
function feedbackLink(recipientId: string, eventId: string, rating: number): string {
  const token = signToken({
    rid: recipientId,
    eid: eventId,
    act: 'feedback.submit',
    ttlSec: FEEDBACK_TTL_SEC,
  });
  return `${BASE_URL}/r?t=${token}&rating=${rating}`;
}

export type FeedbackDispatchResult = { sent: number; skipped: number; failures: number };

/**
 * Find events that ended between 24 h and 48 h ago. For each `going` or
 * `conditional` invited recipient that has not yet received a feedback
 * request, insert an event_feedback row (feedbackSentAt = now) and send the
 * rating email.
 *
 * Idempotent: a second call within the same window sends nothing.
 */
export async function dispatchPostEventFeedback(
  now: Date = new Date(),
): Promise<FeedbackDispatchResult> {
  const windowStart = new Date(now.getTime() - HOURS(48));
  const windowEnd = new Date(now.getTime() - HOURS(24));

  // Events whose startsAt falls in the 24-48 h window.
  const targetEvents = await db
    .select()
    .from(events)
    .where(and(gte(events.startsAt, windowStart), lt(events.startsAt, windowEnd)));

  let sent = 0;
  let skipped = 0;
  let failures = 0;

  for (const event of targetEvents) {
    // Invites for going/conditional recipients.
    const invites = await db
      .select({ invite: eventInvites, rsvp: rsvps, recipient: recipients })
      .from(eventInvites)
      .innerJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
      .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
      .where(
        and(
          eq(eventInvites.eventId, event.id),
          // Only rsvp statuses that mean "was planning to attend".
          // Using raw SQL `in` via drizzle's inArray would work, but we can
          // filter in JS for clarity since the result set is small.
        ),
      );

    const eligible = invites.filter(
      (row) => row.rsvp.status === 'going' || row.rsvp.status === 'conditional',
    );

    for (const row of eligible) {
      // Check for existing feedback row (idempotency guard).
      const [existing] = await db
        .select()
        .from(eventFeedback)
        .where(
          and(
            eq(eventFeedback.eventId, event.id),
            eq(eventFeedback.eventInviteId, row.invite.id),
            isNull(eventFeedback.anonId),
          ),
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      const rid = row.recipient.id;
      const eid = event.id;

      const links = {
        goingNo: feedbackLink(rid, eid, 0),
        going1: feedbackLink(rid, eid, 1),
        going2: feedbackLink(rid, eid, 2),
        going3: feedbackLink(rid, eid, 3),
        going4: feedbackLink(rid, eid, 4),
        going5: feedbackLink(rid, eid, 5),
      };

      const tmpl = postEventFeedbackEmail({ recipient: row.recipient, event, links });
      try {
        await sendEmail({ to: row.recipient.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
        // Insert the feedback row only after a successful send, so a failed
        // delivery is retried on the next cron run rather than silently dropped.
        await db.insert(eventFeedback).values({
          eventId: event.id,
          eventInviteId: row.invite.id,
          feedbackSentAt: now,
        });
        sent++;
      } catch (err) {
        log.error({ err, recipientId: rid, eventId: eid }, 'cron.feedback.send_failed');
        failures++;
      }
    }
  }

  return { sent, skipped, failures };
}

// Keep the import of `isNull` from being removed by the linter.
void isNull;
