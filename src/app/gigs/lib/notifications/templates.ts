import type { Event, Recipient } from '../db/schema';

export function inviteEmail(args: {
  buyer: { name: string; email: string };
  recipient: Recipient;
  event: Event;
  links: { in: string; maybe: string; out: string; view: string; respond?: string };
}): { subject: string; html: string; text: string } {
  const { buyer, recipient, event, links } = args;
  const when = event.startsAt ? new Date(event.startsAt).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD';
  const price = event.priceLow ? `from $${event.priceLow}` : '';
  const subject = `${buyer.name || 'A friend'} wants you in for ${event.title}`;
  const text = [
    `Hey ${recipient.displayName},`,
    '',
    `${buyer.name || buyer.email} flagged a gig:`,
    `${event.title}`,
    event.venue ? `at ${event.venue}` : '',
    when,
    price,
    '',
    'Are you in?',
    `I'm in: ${links.in}`,
    `Maybe:   ${links.maybe}`,
    `Not this time: ${links.out}`,
    '',
    links.respond ? `Got a condition? "Yes if 2 others go" / "yes if under $40": ${links.respond}` : '',
    '',
    `Event page: ${links.view}`,
  ].filter(Boolean).join('\n');
  const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<p>Hey ${escapeHtml(recipient.displayName)},</p>
<p><strong>${escapeHtml(buyer.name || buyer.email)}</strong> flagged a gig:</p>
<h2 style="margin:8px 0">${escapeHtml(event.title)}</h2>
${event.venue ? `<p>at ${escapeHtml(event.venue)}</p>` : ''}
<p>${escapeHtml(when)}${price ? ` · ${escapeHtml(price)}` : ''}</p>
<p style="margin:28px 0">
  <a href="${links.in}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px">I'm in</a>
  <a href="${links.maybe}" style="display:inline-block;padding:12px 20px;background:#ca8a04;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px">Maybe</a>
  <a href="${links.out}" style="display:inline-block;padding:12px 20px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px">Not this time</a>
</p>
<p><a href="${links.view}" style="color:#0ea5e9">See who else is in →</a></p>
${links.respond ? `<p style="font-size:13px;color:#555">Want a conditional yes? <a href="${links.respond}" style="color:#0ea5e9">Set conditions</a> ("yes if 2 others go" / "yes if under $40" / "yes if we get a promo code").</p>` : ''}
</body></html>`.trim();
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
