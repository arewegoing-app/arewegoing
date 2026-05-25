import type { Event, Recipient } from '../db/schema';

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function lockConfirmationEmail(args: {
  buyer: { name: string; email: string };
  recipient: Recipient;
  event: Event;
  amountCents: number;
  promoCode: string | null;
  links: { bail: string; view: string };
}): { subject: string; html: string; text: string } {
  const { buyer, recipient, event, amountCents, promoCode, links } = args;
  const buyerLabel = buyer.name || buyer.email || 'the buyer';
  const subject = `You're locked in for ${event.title} — ${fmt(amountCents)} to ${buyerLabel}`;
  const text = [
    `Hey ${recipient.displayName},`,
    '',
    `${buyerLabel} just bought tickets for ${event.title}.`,
    `You owe ${fmt(amountCents)}.`,
    promoCode ? `Promo code applied: ${promoCode}` : '',
    '',
    `Pay back via bank transfer to ${buyer.email || '[ask the buyer]'}.`,
    '',
    `Need to drop? ${links.bail}`,
    `Your ticket will be offered to the rest of the crew. If nobody claims it before the deadline, you still owe.`,
    '',
    `See event: ${links.view}`,
  ].filter(Boolean).join('\n');
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<p>Hey ${escapeHtml(recipient.displayName)},</p>
<p><strong>${escapeHtml(buyerLabel)}</strong> just bought tickets for <strong>${escapeHtml(event.title)}</strong>.</p>
<p>You owe <strong>${fmt(amountCents)}</strong>.</p>
${promoCode ? `<p style="color:#16a34a">Promo code applied: <strong>${escapeHtml(promoCode)}</strong></p>` : ''}
<p style="color:#555">Pay back via bank transfer to ${escapeHtml(buyer.email || '[ask the buyer]')}.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
<p style="font-size:14px;color:#555">
  Need to drop? <a href="${links.bail}" style="color:#0ea5e9">Tap here</a> — your ticket will be offered to the rest of the crew. If nobody claims it before the deadline, you still owe.
</p>
<p style="font-size:14px"><a href="${links.view}" style="color:#0ea5e9">See event details →</a></p>
</body></html>`.trim();
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
