'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { db } from '../db/client';
import { events, recipients, eventInvites, users, groupMembers } from '../db/schema';
import { auth } from '../auth/auth';
import { getOrSetAnonId, readAnonId } from '../anon/identity';
import { signToken } from '../tokens/token-service';
import { sendEmail } from '../notifications/email';
import { inviteEmail } from '../notifications/templates';
import { getOrCreateDefaultGroup } from '../groups/actions';

const makeSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

async function requireBuyer() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  return session.user;
}

// Returns either { userId } for signed-in owners or { anonId } for cookie-only owners.
// Sets the anon cookie if missing so the caller has a stable identity.
async function ownerIdentity(): Promise<{ userId: string | null; anonId: string | null }> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id, anonId: null };
  const anonId = await getOrSetAnonId();
  return { userId: null, anonId };
}

const createEventInput = z.object({
  title: z.string().min(1).max(200),
  venue: z.string().max(200).optional(),
  city: z.string().max(100).default('Wellington'),
  startsAt: z.string().optional(),
  ticketUrl: z.url().optional().or(z.literal('')),
  priceLow: z.coerce.number().int().nonnegative().optional(),
});

export async function createEvent(formData: FormData) {
  const buyer = await requireBuyer();
  const raw = Object.fromEntries(formData.entries());
  const parsed = createEventInput.parse({ ...raw, ticketUrl: raw.ticketUrl || undefined });
  const slug = makeSlug();
  const [event] = await db.insert(events).values({
    slug,
    ownerUserId: buyer.id,
    title: parsed.title,
    venue: parsed.venue ?? null,
    city: parsed.city,
    startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
    ticketUrl: parsed.ticketUrl || null,
    priceLow: parsed.priceLow ?? null,
  }).returning();
  redirect(`/e/${event.slug}`);
}

const addRecipientInput = z.object({
  email: z.email(),
  displayName: z.string().min(1).max(100),
});

export async function addRecipient(formData: FormData) {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) throw new Error('no_identity');
  const parsed = addRecipientInput.parse(Object.fromEntries(formData.entries()));
  const [recipient] = await db.insert(recipients).values({
    ownerUserId: id.userId,
    anonOwnerId: id.anonId,
    email: parsed.email.toLowerCase(),
    displayName: parsed.displayName,
  }).onConflictDoNothing().returning();

  // Automatically add the new recipient to the buyer's default group.
  if (recipient) {
    const defaultGroup = await getOrCreateDefaultGroup();
    await db
      .insert(groupMembers)
      .values({ groupId: defaultGroup.id, recipientId: recipient.id })
      .onConflictDoNothing();
  }
}

const sendInvitesInput = z.object({
  eventId: z.string().min(1),
  recipientIds: z.array(z.string().min(1)).min(1),
});

const APP_URL = process.env.GIGS_APP_URL ?? 'http://localhost:3000';
const INVITE_TTL_SEC = 60 * 60 * 24 * 30;

export async function sendInvites(input: { eventId: string; recipientIds: string[] }) {
  const id = await ownerIdentity();
  if (!id.userId && !id.anonId) throw new Error('no_identity');
  const parsed = sendInvitesInput.parse(input);
  const [event] = await db.select().from(events).where(eq(events.id, parsed.eventId)).limit(1);
  if (!event) throw new Error('Event not found');
  const isOwner = id.userId
    ? event.ownerUserId === id.userId
    : event.anonOwnerId === id.anonId;
  if (!isOwner) throw new Error('not_owner');
  const recips = await db.select().from(recipients).where(inArray(recipients.id, parsed.recipientIds));
  const buyerName = id.userId
    ? (await db.select().from(users).where(eq(users.id, id.userId)).limit(1))[0]?.name ?? ''
    : event.anonOwnerName ?? '';
  const buyerEmail = id.userId
    ? (await db.select().from(users).where(eq(users.id, id.userId)).limit(1))[0]?.email ?? ''
    : event.anonOwnerEmail ?? '';
  const buyerRow = { name: buyerName, email: buyerEmail };
  const sent: string[] = [];
  for (const r of recips) {
    await db.insert(eventInvites).values({ eventId: event.id, recipientId: r.id }).onConflictDoNothing();
    const links = {
      in: `${APP_URL}/r?t=${signToken({ rid: r.id, eid: event.id, act: 'rsvp.in', ttlSec: INVITE_TTL_SEC })}`,
      maybe: `${APP_URL}/r?t=${signToken({ rid: r.id, eid: event.id, act: 'rsvp.maybe', ttlSec: INVITE_TTL_SEC })}`,
      out: `${APP_URL}/r?t=${signToken({ rid: r.id, eid: event.id, act: 'rsvp.out', ttlSec: INVITE_TTL_SEC })}`,
      view: `${APP_URL}/e/${event.slug}?t=${signToken({ rid: r.id, eid: event.id, act: 'view', ttlSec: INVITE_TTL_SEC })}`,
      respond: `${APP_URL}/e/${event.slug}/respond?t=${signToken({ rid: r.id, eid: event.id, act: 'rsvp.respond', ttlSec: INVITE_TTL_SEC })}`,
    };
    const tmpl = inviteEmail({
      buyer: buyerRow,
      recipient: r,
      event,
      links,
    });
    const result = await sendEmail({ to: r.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
    sent.push(result.id);
  }
  return { sent: sent.length };
}
