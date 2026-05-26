import { eq, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client';
import { log } from '../log';
import { artists, artistSubscriptions, eventArtistLinks, events } from '../db/schema';
import { sendEmail } from '../notifications/email';
import { fetchArtistNZEvents, type ParsedArtistEvent } from './songkick';

const APP_URL = process.env.GIGS_APP_URL ?? 'http://localhost:3000';

/**
 * For every artist subscription, fetch upcoming NZ events from Songkick and:
 *  - Find events whose startDate is newer than notifiedThroughAt watermark
 *    (or all events when notifiedThroughAt is null).
 *  - If a matching event row already exists (matched by sourceUrl OR title+date),
 *    link it via eventArtistLinks and email the subscriber.
 *  - If no event row exists, draft one (ownerUserId=null, discoveredAt=now,
 *    source='songkick') and link it.
 *  - Advance notifiedThroughAt to the latest startDate processed.
 *
 * Running the dispatcher twice without new Songkick events is idempotent: the
 * watermark advances past all already-notified events.
 *
 * @param now - Timestamp used as discoveredAt for newly drafted events.
 * @param fetchImpl - Optional override for the Songkick fetch (used in tests).
 * @returns Count of emails sent.
 */
export async function dispatchArtistNotifications(
  now: Date = new Date(),
  fetchImpl: (artistId: string) => Promise<ParsedArtistEvent[]> = fetchArtistNZEvents,
): Promise<{ sent: number; failures: number }> {
  const subs = await db
    .select()
    .from(artistSubscriptions)
    .where(isNotNull(artistSubscriptions.email));

  let sent = 0;
  let failures = 0;

  for (const sub of subs) {
    if (!sub.email) continue;

    // Load the artist record.
    const [artist] = await db
      .select()
      .from(artists)
      .where(eq(artists.id, sub.artistId))
      .limit(1);
    if (!artist) continue;

    // Fetch upcoming NZ events (returns [] when no API key or fetch fails).
    const skEvents = await fetchImpl(artist.songkickId ?? '');

    const watermark = sub.notifiedThroughAt ?? new Date(0);

    // Only process events newer than watermark.
    const pending = skEvents.filter((e) => {
      if (!e.startDate) return false;
      return new Date(e.startDate) > watermark;
    });

    if (pending.length === 0) continue;

    let latestDate = watermark;

    for (const skEvent of pending) {
      const eventRow = await resolveOrDraftEvent(skEvent, artist.id, now);
      if (!eventRow) continue;

      await ensureArtistLink(eventRow.id, artist.id);

      const dateLabel = formatDate(skEvent.startDate);
      const url = `${APP_URL}/e/${eventRow.slug}`;
      const subject = `${artist.name} is playing in NZ: ${skEvent.title}`;
      const text = [
        'Hey,',
        '',
        `${artist.name} has an upcoming show in New Zealand:`,
        skEvent.title,
        skEvent.venue ? `at ${skEvent.venue}, ${skEvent.city}` : skEvent.city,
        dateLabel,
        '',
        `See it: ${url}`,
      ]
        .filter(Boolean)
        .join('\n');
      const html = `<p><strong>${escapeHtml(artist.name)}</strong> has an upcoming NZ show:</p><p><strong>${escapeHtml(skEvent.title)}</strong>${skEvent.venue ? ` at ${escapeHtml(skEvent.venue)}, ${escapeHtml(skEvent.city)}` : ''}<br>${escapeHtml(dateLabel)}</p><p><a href="${url}">See it →</a></p>`;

      try {
        await sendEmail({ to: sub.email, subject, text, html });
        sent++;
        if (skEvent.startDate && new Date(skEvent.startDate) > latestDate) {
          latestDate = new Date(skEvent.startDate);
        }
      } catch (err) {
        log.error({ err, subscriptionId: sub.id, artistId: artist.id, eventTitle: skEvent.title }, 'cron.artists.send_failed');
        failures++;
      }
    }

    // Advance watermark only when latestDate moved past the original watermark,
    // meaning at least one send succeeded. Failed events remain above the
    // watermark and will be retried on the next run.
    if (latestDate > watermark) {
      await db
        .update(artistSubscriptions)
        .set({ notifiedThroughAt: latestDate })
        .where(eq(artistSubscriptions.id, sub.id));
    }
  }

  return { sent, failures };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find an existing event row matching the Songkick event (by sourceUrl or
 * title+date), or create a draft event row with ownerUserId=null.
 */
async function resolveOrDraftEvent(
  skEvent: ParsedArtistEvent,
  _artistId: string,
  now: Date,
): Promise<{ id: string; slug: string } | null> {
  // Try to match by sourceUrl first.
  if (skEvent.sourceUrl) {
    const [existing] = await db
      .select({ id: events.id, slug: events.slug })
      .from(events)
      .where(eq(events.sourceUrl, skEvent.sourceUrl))
      .limit(1);
    if (existing) return existing;
  }

  // Try to match by title + date.
  if (skEvent.title && skEvent.startDate) {
    const startsAt = new Date(skEvent.startDate);
    const all = await db
      .select({ id: events.id, slug: events.slug, startsAt: events.startsAt })
      .from(events)
      .where(eq(events.title, skEvent.title));
    const match = all.find(
      (r) => r.startsAt && Math.abs(r.startsAt.getTime() - startsAt.getTime()) < 24 * 3600_000,
    );
    if (match) return { id: match.id, slug: match.slug };
  }

  // Draft a new event.
  const slug = `sk-${nanoid(10)}`;
  const [created] = await db
    .insert(events)
    .values({
      slug,
      title: skEvent.title,
      venue: skEvent.venue || null,
      city: skEvent.city || 'New Zealand',
      startsAt: skEvent.startDate ? new Date(skEvent.startDate) : null,
      source: 'songkick',
      sourceUrl: skEvent.sourceUrl || null,
      discoveredAt: now,
      status: 'active',
    })
    .returning({ id: events.id, slug: events.slug });
  return created ?? null;
}

/**
 * Ensure an eventArtistLinks row exists for the given pair. Idempotent.
 */
async function ensureArtistLink(eventId: string, artistId: string): Promise<void> {
  await db
    .insert(eventArtistLinks)
    .values({ eventId, artistId })
    .onConflictDoNothing();
}

function formatDate(iso: string): string {
  if (!iso) return 'TBD';
  try {
    return new Date(iso).toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}
