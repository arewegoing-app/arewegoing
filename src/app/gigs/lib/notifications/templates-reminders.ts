import type { Event, Recipient } from '../db/schema';

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function reminderEmail(args: {
  buyer: { name: string; email: string };
  recipient: Recipient;
  event: Event;
  amountCents: number;
  daysOutstanding: number;
  payLink?: string;
}): { subject: string; html: string; text: string } {
  const { buyer, recipient, event, amountCents, daysOutstanding } = args;
  const tone =
    daysOutstanding >= 7
      ? "It's been over a week — could you sort this today?"
      : daysOutstanding >= 3
        ? 'Friendly nudge — should be a quick transfer.'
        : "Just a heads-up — you owe for this one.";
  const subject = `Reminder: ${fmt(amountCents)} owed for ${event.title}`;
  const text = [
    `Hey ${recipient.displayName},`,
    '',
    `${buyer.name || buyer.email} bought tickets for ${event.title} ${daysOutstanding} day${daysOutstanding === 1 ? '' : 's'} ago.`,
    `You owe ${fmt(amountCents)}.`,
    '',
    tone,
    '',
    `Pay back: bank transfer to ${buyer.email || '[ask the buyer]'}.`,
  ].join('\n');
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<p>Hey ${escapeHtml(recipient.displayName)},</p>
<p><strong>${escapeHtml(buyer.name || buyer.email)}</strong> bought tickets for <strong>${escapeHtml(event.title)}</strong> ${daysOutstanding} day${daysOutstanding === 1 ? '' : 's'} ago.</p>
<p>You owe <strong>${fmt(amountCents)}</strong>.</p>
<p>${escapeHtml(tone)}</p>
<p style="color:#555">Pay back: bank transfer to ${escapeHtml(buyer.email || '[ask the buyer]')}.</p>
</body></html>`.trim();
  return { subject, html, text };
}

export function rallyUpdateEmail(args: {
  buyer: { name: string; email: string };
  recipient: Recipient;
  event: Event;
  goingNames: string[];
  pendingCount: number;
  viewLink: string;
}): { subject: string; html: string; text: string } {
  const { buyer, recipient, event, goingNames, pendingCount, viewLink } = args;
  const subject = `${goingNames.length} of us are in for ${event.title}`;
  const text = [
    `Hey ${recipient.displayName},`,
    '',
    `Update on ${event.title}: ${goingNames.join(', ')} ${goingNames.length === 1 ? 'is' : 'are'} in.`,
    pendingCount > 0 ? `${pendingCount} still pending.` : 'Everyone has responded.',
    '',
    `${buyer.name || buyer.email} will start the final call soon — your pledge link will come from them.`,
    '',
    `See the event: ${viewLink}`,
  ].join('\n');
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<p>Hey ${escapeHtml(recipient.displayName)},</p>
<p><strong>${escapeHtml(goingNames.join(', '))}</strong> ${goingNames.length === 1 ? 'is' : 'are'} in for <strong>${escapeHtml(event.title)}</strong>.</p>
<p>${pendingCount > 0 ? `${pendingCount} still pending.` : 'Everyone has responded.'}</p>
<p><a href="${viewLink}" style="color:#0ea5e9">See the event →</a></p>
</body></html>`.trim();
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
