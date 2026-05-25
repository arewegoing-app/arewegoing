import type { Event, Recipient } from '../db/schema';

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function resaleOfferEmail(args: {
  recipient: Recipient;
  event: Event;
  bailerName: string;
  amountCents: number;
  expiresAt: Date;
  claimLink: string;
}): { subject: string; html: string; text: string } {
  const { recipient, event, bailerName, amountCents, expiresAt, claimLink } = args;
  const subject = `${bailerName} dropped — ticket up for grabs: ${event.title}`;
  const text = [
    `Hey ${recipient.displayName},`,
    '',
    `${bailerName} can't make ${event.title}.`,
    `Their ticket is now available for ${fmt(amountCents)}.`,
    `First-come, first-served. Listing closes ${expiresAt.toLocaleString('en-NZ')}.`,
    '',
    `Take the ticket: ${claimLink}`,
  ].join('\n');
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<p>Hey ${escapeHtml(recipient.displayName)},</p>
<p><strong>${escapeHtml(bailerName)}</strong> can&apos;t make <strong>${escapeHtml(event.title)}</strong>.</p>
<p>Their ticket is now available for <strong>${fmt(amountCents)}</strong>. First-come, first-served.</p>
<p>Listing closes <strong>${escapeHtml(expiresAt.toLocaleString('en-NZ'))}</strong>.</p>
<p style="margin:24px 0">
  <a href="${claimLink}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px">Take the ticket</a>
</p>
</body></html>`.trim();
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
