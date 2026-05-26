'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { events } from '../db/schema';
import { checkEventOwner } from '../auth/owner';
import { ingest } from '../ingest/fetch';
import { detectSeries, normalizeVenue } from '../discovery/detect';

const input = z.object({ eventId: z.string().min(1) });

export type RefreshResult =
  | { ok: true; updated: boolean }
  | { ok: false; reason: string };

export async function refreshEventMetadata(raw: z.input<typeof input>): Promise<RefreshResult> {
  const parsed = input.parse(raw);
  const [event] = await db.select().from(events).where(eq(events.id, parsed.eventId)).limit(1);
  if (!event) return { ok: false, reason: 'no_event' };

  const ownerCheck = await checkEventOwner(event);
  if (!ownerCheck.isOwner) return { ok: false, reason: 'not_owner' };

  const sourceUrl = event.sourceUrl ?? event.ticketUrl;
  if (!sourceUrl) return { ok: false, reason: 'no_source_url' };

  const r = await ingest(sourceUrl);
  if (!r.ok) return { ok: false, reason: r.reason };

  const m = r.metadata;
  const series = detectSeries(m.title) ?? event.seriesName;
  const venue = normalizeVenue(m.venue) ?? m.venue ?? event.venue;
  const updates: Partial<typeof events.$inferInsert> = {};
  let touched = false;

  if (m.title && m.title !== event.title) {
    updates.title = m.title;
    touched = true;
  }
  if (venue && venue !== event.venue) {
    updates.venue = venue;
    touched = true;
  }
  if (m.city && m.city !== event.city) {
    updates.city = m.city;
    touched = true;
  }
  if (m.startsAt) {
    const newStart = new Date(m.startsAt);
    if (!event.startsAt || event.startsAt.getTime() !== newStart.getTime()) {
      updates.startsAt = newStart;
      touched = true;
    }
  }
  if (m.priceLow != null && m.priceLow !== event.priceLow) {
    updates.priceLow = m.priceLow;
    touched = true;
  }
  if (m.imageUrl && m.imageUrl !== event.imageUrl) {
    updates.imageUrl = m.imageUrl;
    touched = true;
  }
  if (series && series !== event.seriesName) {
    updates.seriesName = series;
    touched = true;
  }

  if (touched) {
    await db.update(events).set(updates).where(eq(events.id, event.id));
  }

  return { ok: true, updated: touched };
}
