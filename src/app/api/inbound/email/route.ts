import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { parseTicketEmail } from '@/lib/ingest/email-forward/parser';
import { ensureMigrated, db } from '@/lib/db/client';
import { users, events, recipients, eventInvites } from '@/lib/db/schema';
import { isProductionEnv } from '@/lib/env';
import { safeEqualSecret } from '@/lib/auth/secret-compare';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

const makeSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const inboundEmailSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().min(1),
  text: z.string().default(''),
  html: z.string().default(''),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Bearer-token auth. The webhook provider (e.g. Resend/SendGrid) is the
  // authority on sender identity via upstream SPF/DKIM; this secret stops
  // anyone else POSTing forged `from:` payloads that would otherwise be
  // accepted as that user's ticket purchase. INBOUND_AUTH_OFF=1 is a
  // local-dev/test escape hatch only — never honoured in production.
  const requiredSecret = process.env.INBOUND_SECRET;
  if (!requiredSecret) {
    if (isProductionEnv() || process.env.INBOUND_AUTH_OFF !== '1') {
      log.warn({ reason: 'inbound_not_configured' }, 'inbound.unauthorized');
      return NextResponse.json({ error: 'inbound_not_configured' }, { status: 503 });
    }
  } else {
    const header = req.headers.get('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      log.warn({ reason: 'bad_secret' }, 'inbound.unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const provided = header.slice('Bearer '.length).trim();
    if (!safeEqualSecret(provided, requiredSecret)) {
      log.warn({ reason: 'bad_secret' }, 'inbound.unauthorized');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    log.info({ reason: 'invalid_json' }, 'inbound.rejected');
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  const parsed = inboundEmailSchema.safeParse(body);
  if (!parsed.success) {
    log.info(
      { reason: 'invalid_payload', keys: body && typeof body === 'object' ? Object.keys(body as object) : [] },
      'inbound.rejected',
    );
    return NextResponse.json(
      { ok: false, reason: 'invalid_payload', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const mime = parsed.data;

  // Parse the ticket email
  const parseResult = await parseTicketEmail(mime);
  if (!parseResult.ok) {
    log.info(
      { reason: parseResult.reason, subject: mime.subject, textLen: mime.text.length, htmlLen: mime.html.length },
      'inbound.rejected',
    );
    return NextResponse.json({ ok: false, reason: parseResult.reason });
  }

  await ensureMigrated();

  // Resolve sender to a known user
  // Extract bare address from "Display Name <addr>" format
  const senderAddress = mime.from.match(/<([^>]+)>/) ?
    (mime.from.match(/<([^>]+)>/) as RegExpMatchArray)[1].trim().toLowerCase() :
    mime.from.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, senderAddress))
    .limit(1);

  if (!user) {
    log.info({ reason: 'unknown_sender', sender: senderAddress }, 'inbound.rejected');
    return NextResponse.json({ ok: false, reason: 'unknown_sender' });
  }

  const meta = parseResult.meta;

  // Upsert the event. Use sourceUrl as the dedup key when available,
  // otherwise fall back to a slug derived from the order number + source.
  let eventRow: typeof events.$inferSelect | undefined;

  if (meta.sourceUrl) {
    const [existing] = await db
      .select()
      .from(events)
      .where(eq(events.sourceUrl, meta.sourceUrl))
      .limit(1);
    eventRow = existing;
  }

  if (!eventRow) {
    const slug = makeSlug();
    const [inserted] = await db
      .insert(events)
      .values({
        slug,
        ownerUserId: user.id,
        title: meta.title,
        venue: meta.venue ?? null,
        city: meta.city ?? 'Wellington',
        startsAt: meta.startsAt ? new Date(meta.startsAt) : null,
        priceLow: meta.priceLow ?? null,
        ticketUrl: meta.sourceUrl ?? null,
        sourceUrl: meta.sourceUrl ?? null,
        source: meta.source,
        status: 'active',
      })
      .returning();
    eventRow = inserted;
  }

  // Find or create a recipient row for the sender
  let recipientRow: typeof recipients.$inferSelect | undefined;
  const [existingRecipient] = await db
    .select()
    .from(recipients)
    .where(eq(recipients.email, senderAddress))
    .limit(1);

  if (existingRecipient) {
    recipientRow = existingRecipient;
  } else {
    const [inserted] = await db
      .insert(recipients)
      .values({
        ownerUserId: user.id,
        email: senderAddress,
        displayName: user.name ?? senderAddress,
      })
      .returning();
    recipientRow = inserted;
  }

  // Create the event invite with has_own_ticket=1
  await db
    .insert(eventInvites)
    .values({
      eventId: eventRow.id,
      recipientId: recipientRow.id,
      hasOwnTicket: 1,
    })
    .onConflictDoUpdate({
      target: [eventInvites.eventId, eventInvites.recipientId],
      set: { hasOwnTicket: 1 },
    });

  log.info(
    { from: senderAddress, subject: mime.subject, source: meta.source, eventId: eventRow.id },
    'inbound.accepted',
  );
  return NextResponse.json({
    ok: true,
    eventSlug: eventRow.slug,
    eventId: eventRow.id,
    recipientId: recipientRow.id,
    source: meta.source,
    title: meta.title,
  });
}
