'use server';

import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { auth } from '../auth/auth';
import {
  events,
  eventInvites,
  finalCalls,
  owed,
  pledgeCommitments,
  purchases,
  recipients,
  rsvps,
  users,
} from '../db/schema';
import { sendEmail } from '../notifications/email';
import { lockConfirmationEmail } from '../notifications/templates-lock';
import { signToken } from '../tokens/token-service';
import { log } from '../log';

const APP_URL = process.env.GIGS_APP_URL ?? 'http://localhost:3000';
const BAIL_TTL_SEC = 60 * 60 * 24 * 30;

const recordInput = z.object({
  eventId: z.string().min(1),
  totalCents: z.coerce.number().int().positive(),
  ticketCount: z.coerce.number().int().positive(),
  promoCode: z.string().max(64).optional(),
});

export async function recordPurchase(input: z.input<typeof recordInput>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const parsed = recordInput.parse(input);

  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, parsed.eventId), eq(events.ownerUserId, session.user.id)))
    .limit(1);
  if (!event) throw new Error('Event not found');

  // People who already have their own ticket are excluded — they don't owe.
  const pledgedAll = await db
    .select({ invite: eventInvites, recipient: recipients, rsvp: rsvps })
    .from(eventInvites)
    .innerJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
    .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .where(and(eq(eventInvites.eventId, event.id), eq(rsvps.pledgeState, 'pledged')));
  const pledged = pledgedAll.filter((p) => p.invite.hasOwnTicket !== 1);
  if (pledged.length === 0) throw new Error('No pledged recipients to lock');

  const splitCents = Math.ceil(parsed.totalCents / pledged.length);

  const [purchase] = await db
    .insert(purchases)
    .values({
      eventId: event.id,
      buyerUserId: session.user.id,
      totalCents: parsed.totalCents,
      ticketCount: parsed.ticketCount,
      promoCode: parsed.promoCode ?? null,
    })
    .returning();

  await db.insert(owed).values(
    pledged.map(({ invite }) => ({
      purchaseId: purchase.id,
      eventInviteId: invite.id,
      amountCents: splitCents,
    })),
  );

  await db
    .update(rsvps)
    .set({ pledgeState: 'locked', lockedAt: new Date(), updatedAt: new Date() })
    .where(inArray(rsvps.eventInviteId, pledged.map((p) => p.invite.id)));

  // Close pending final calls — they're done now
  await db
    .update(finalCalls)
    .set({ status: 'closed', closedAt: new Date() })
    .where(and(eq(finalCalls.eventId, event.id), eq(finalCalls.status, 'pending')));

  const [buyer] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  for (const { recipient } of pledged) {
    const bailLink = `${APP_URL}/r?t=${signToken({
      rid: recipient.id,
      eid: event.id,
      act: 'bail.request',
      ttlSec: BAIL_TTL_SEC,
    })}`;
    const viewLink = `${APP_URL}/e/${event.slug}`;
    const tmpl = lockConfirmationEmail({
      buyer: { name: buyer?.name ?? '', email: buyer?.email ?? '' },
      recipient,
      event,
      amountCents: splitCents,
      promoCode: parsed.promoCode ?? null,
      links: { bail: bailLink, view: viewLink },
    });
    await sendEmail({ to: recipient.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
  }

  log.info(
    {
      eid: event.id,
      purchaseId: purchase.id,
      locked: pledged.length,
      splitCents,
      totalCents: parsed.totalCents,
    },
    'purchase.recorded',
  );
  return { purchaseId: purchase.id, locked: pledged.length, splitCents };
}

const markPaidInput = z.object({ owedId: z.string().min(1), paid: z.boolean() });

export async function markPaid(input: z.input<typeof markPaidInput>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in');
  const parsed = markPaidInput.parse(input);

  const [row] = await db
    .select({ owed: owed, purchase: purchases })
    .from(owed)
    .innerJoin(purchases, eq(purchases.id, owed.purchaseId))
    .where(eq(owed.id, parsed.owedId))
    .limit(1);
  if (!row) throw new Error('Not found');
  if (row.purchase.buyerUserId !== session.user.id) throw new Error('Not your purchase');

  await db
    .update(owed)
    .set({ paid: parsed.paid ? 1 : 0, paidAt: parsed.paid ? new Date() : null })
    .where(eq(owed.id, parsed.owedId));

  log.info({ owedId: parsed.owedId, paid: parsed.paid }, 'owed.markPaid');
  return { ok: true };
}
