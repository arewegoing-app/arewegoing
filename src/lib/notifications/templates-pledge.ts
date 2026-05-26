import type { Event, Recipient } from '../db/schema';

export function finalCallEmail(args: {
  buyer: { name: string; email: string };
  recipient: Recipient;
  event: Event;
  pledgeAmount: number;
  deadlineAt: Date;
  links: { confirm: string; drop: string; view: string };
}): { subject: string; html: string; text: string } {
  const { buyer, recipient, event, pledgeAmount, deadlineAt, links } = args;
  const deadlineStr = deadlineAt.toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' });
  const subject = `Last call: pledge $${pledgeAmount} for ${event.title}`;
  const text = [
    `Hey ${recipient.displayName},`,
    '',
    `${buyer.name || buyer.email} is about to buy tickets for ${event.title}.`,
    `You'll owe $${pledgeAmount}.`,
    `If you bail later you owe it anyway, or you need to find a replacement.`,
    '',
    `Confirm by ${deadlineStr}.`,
    '',
    `Confirm pledge: ${links.confirm}`,
    `Drop me: ${links.drop}`,
    '',
    `Event details: ${links.view}`,
  ].join('\n');
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<p>Hey ${escapeHtml(recipient.displayName)},</p>
<p><strong>${escapeHtml(buyer.name || buyer.email)}</strong> is about to buy tickets for <strong>${escapeHtml(event.title)}</strong>.</p>
<p>You'll owe <strong>$${pledgeAmount}</strong>. If you bail later you still owe it (or you need to find a replacement).</p>
<p>Confirm by <strong>${escapeHtml(deadlineStr)}</strong>.</p>
<p style="margin:28px 0">
  <a href="${links.confirm}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px">Pledge $${pledgeAmount}</a>
  <a href="${links.drop}" style="display:inline-block;padding:12px 20px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px">Drop me</a>
</p>
<p><a href="${links.view}" style="color:#0ea5e9">See event →</a></p>
</body></html>`.trim();
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
