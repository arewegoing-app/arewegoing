import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import { log } from '../log';
import { events, seriesSubscriptions } from '../db/schema';
import { sendEmail } from '../notifications/email';

const APP_URL = process.env.GIGS_APP_URL ?? 'http://localhost:3000';

/**
 * Send one email per subscriber for every event created in their series since
 * the subscriber's last notified_through_at watermark. Idempotent: running
 * twice without a new event in between is a no-op because the watermark
 * advances to the latest event's createdAt after each pass.
 */
export async function dispatchSeriesNotifications(): Promise<{ sent: number; failures: number }> {
  const subs = await db.select().from(seriesSubscriptions).where(isNotNull(seriesSubscriptions.email));

  let sent = 0;
  let failures = 0;
  for (const sub of subs) {
    const watermark = sub.notifiedThroughAt ?? new Date(0);
    const pending = await db
      .select()
      .from(events)
      .where(
        and(eq(events.seriesName, sub.seriesName), gt(events.createdAt, watermark)),
      )
      .orderBy(events.createdAt);

    if (pending.length === 0) continue;

    // Track the highest createdAt among successful sends only. The watermark
    // only advances to this value, so events whose send failed are retried on
    // the next cron run instead of being skipped.
    let highestSuccessCreatedAt: Date | null = null;

    for (const ev of pending) {
      if (!sub.email) continue;
      const date = ev.startsAt
        ? new Date(ev.startsAt).toLocaleString('en-NZ', {
            timeZone: 'Pacific/Auckland',
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'TBD';
      const url = `${APP_URL}/e/${ev.slug}`;
      const subject = `New ${sub.seriesName} event: ${ev.title}`;
      const text = [
        'Hey,',
        '',
        `A new ${sub.seriesName} gig just appeared:`,
        ev.title,
        ev.venue ? `at ${ev.venue}` : '',
        date,
        '',
        `See it: ${url}`,
      ]
        .filter(Boolean)
        .join('\n');
      const html = `<p>A new <strong>${escapeHtml(sub.seriesName)}</strong> gig:</p><p><strong>${escapeHtml(ev.title)}</strong>${ev.venue ? ` at ${escapeHtml(ev.venue)}` : ''}<br>${escapeHtml(date)}</p><p><a href="${url}">See it →</a></p>`;
      try {
        await sendEmail({ to: sub.email, subject, text, html });
        sent++;
        if (ev.createdAt && (!highestSuccessCreatedAt || ev.createdAt > highestSuccessCreatedAt)) {
          highestSuccessCreatedAt = ev.createdAt;
        }
      } catch (err) {
        log.error({ err, subscriptionId: sub.id, eventId: ev.id }, 'cron.series.send_failed');
        failures++;
      }
    }

    // Only advance the watermark when at least one send succeeded. Using the
    // highest successful createdAt (not the last event in the batch) means
    // any failed events remain above the watermark and will be retried next run.
    if (highestSuccessCreatedAt !== null) {
      await db
        .update(seriesSubscriptions)
        .set({ notifiedThroughAt: highestSuccessCreatedAt })
        .where(eq(seriesSubscriptions.id, sub.id));
    }
  }
  return { sent, failures };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
