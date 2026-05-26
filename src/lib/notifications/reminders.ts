import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { log } from '../log';
import { events, eventInvites, owed, purchases, recipients, users } from '../db/schema';
import { sendEmail } from './email';
import { reminderEmail } from './templates-reminders';

const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

export type ReminderResult = { sent: number; skipped: number; failures: number };

export async function dispatchOverdueReminders(now: Date = new Date()): Promise<ReminderResult> {
  // Find unpaid owed rows where (purchase.created_at + 24h) is in the past
  // AND (last_reminded_at is null OR last_reminded_at < minGapMs ago).
  // Cadence: daily up to 3 days old, every 2 days after that.

  const candidates = await db
    .select({
      owed: owed,
      purchase: purchases,
      invite: eventInvites,
      recipient: recipients,
      event: events,
      buyer: users,
    })
    .from(owed)
    .innerJoin(purchases, eq(purchases.id, owed.purchaseId))
    .innerJoin(eventInvites, eq(eventInvites.id, owed.eventInviteId))
    .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .innerJoin(events, eq(events.id, purchases.eventId))
    .innerJoin(users, eq(users.id, purchases.buyerUserId))
    .where(eq(owed.paid, 0));

  let sent = 0;
  let skipped = 0;
  let failures = 0;
  for (const row of candidates) {
    const elapsedMs = now.getTime() - new Date(row.purchase.createdAt).getTime();
    if (elapsedMs < DAYS(1)) {
      skipped++;
      continue;
    }
    const daysOutstanding = Math.floor(elapsedMs / DAYS(1));
    const lastRemind = row.owed.lastRemindedAt ? new Date(row.owed.lastRemindedAt).getTime() : 0;
    const minGapMs = daysOutstanding >= 3 ? DAYS(2) : DAYS(1);
    if (lastRemind && now.getTime() - lastRemind < minGapMs) {
      skipped++;
      continue;
    }

    const tmpl = reminderEmail({
      buyer: { name: row.buyer.name ?? '', email: row.buyer.email },
      recipient: row.recipient,
      event: row.event,
      amountCents: row.owed.amountCents,
      daysOutstanding,
    });
    try {
      await sendEmail({ to: row.recipient.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
      await db
        .update(owed)
        .set({ lastRemindedAt: now })
        .where(eq(owed.id, row.owed.id));
      sent++;
    } catch (err) {
      log.error({ err, owedId: row.owed.id, recipientId: row.recipient.id }, 'cron.reminders.send_failed');
      failures++;
    }
  }
  return { sent, skipped, failures };
}
