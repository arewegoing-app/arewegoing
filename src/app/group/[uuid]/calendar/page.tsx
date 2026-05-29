import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { db, ensureMigrated } from '@/lib/db/client';
import { groups, events } from '@/lib/db/schema';
import { listGroupEvents } from '@/lib/groups/membership';
import { listPublicEvents } from '@/lib/discovery/list-public-events';
import { auth } from '@/lib/auth/auth';
import { AnonProfilePrompt } from './anon-profile-prompt';
import { AddEventButton } from './add-event';
import { CalendarReactions } from '@/app/calendar/reactions-row';
import { withRef } from '@/lib/outbound/with-ref';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ uuid: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uuid } = await params;
  await ensureMigrated();

  const [group] = await db.select().from(groups).where(eq(groups.id, uuid)).limit(1);
  if (!group) return { title: 'Group not found' };

  let pinnedEvent: typeof events.$inferSelect | null = null;
  if (group.pinnedEventId) {
    const [ev] = await db.select().from(events).where(eq(events.id, group.pinnedEventId)).limit(1);
    pinnedEvent = ev ?? null;
  }

  const title = pinnedEvent ? `Are we going to ${pinnedEvent.title}?` : group.name;
  const description = pinnedEvent
    ? `${pinnedEvent.title}${pinnedEvent.venue ? ` at ${pinnedEvent.venue}` : ''}${pinnedEvent.city ? `, ${pinnedEvent.city}` : ''}`
    : `Shared group calendar: ${group.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: pinnedEvent?.imageUrl ? [{ url: pinnedEvent.imageUrl }] : [],
    },
  };
}

export default async function GroupCalendarPage({ params }: Props) {
  const { uuid } = await params;
  await ensureMigrated();

  const [group] = await db.select().from(groups).where(eq(groups.id, uuid)).limit(1);
  if (!group) notFound();

  const session = await auth();
  const userId = session?.user?.id;

  const groupEventList = await listGroupEvents(uuid);
  const { dedupedUpcoming } = await listPublicEvents({ userId });

  const groupEventIds = new Set(groupEventList.map((ge) => ge.eventId));

  let pinnedEvent: typeof events.$inferSelect | null = null;
  if (group.pinnedEventId) {
    const [ev] = await db.select().from(events).where(eq(events.id, group.pinnedEventId)).limit(1);
    pinnedEvent = ev ?? null;
  }

  return (
    <div className="space-y-8 sm:space-y-12">
      <section className="pt-4 pb-2">
        <h1
          className="u-display"
          style={{ fontSize: 'clamp(2rem, 8vw, 6rem)', lineHeight: 0.9 }}
        >
          {group.name}
        </h1>
        <p className="u-mono mt-2 opacity-60">Shared group calendar</p>
      </section>

      <AnonProfilePrompt />

      {/* Pinned event section */}
      {pinnedEvent && (
        <section aria-label="Pinned event">
          <div className="ed-section-head">
            <div className="u-mono opacity-50">[pinned]</div>
            <h2 className="u-display" style={{ fontSize: 'clamp(1.25rem, 4vw, 2.5rem)', margin: 0 }}>
              {pinnedEvent.title}
            </h2>
          </div>
          <div className="ed-card p-4 sm:p-5">
            <div className="u-mono opacity-60">
              {pinnedEvent.venue ?? 'Venue TBA'}
              {pinnedEvent.startsAt
                ? ` · ${new Date(pinnedEvent.startsAt).toLocaleString('en-NZ', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'Pacific/Auckland',
                  })}`
                : ' · Date TBD'}
            </div>
            {pinnedEvent.ticketUrl && (
              <a
                href={withRef(pinnedEvent.ticketUrl)}
                target="_blank"
                rel="noreferrer"
                className="u-mono mt-2 inline-flex items-center gap-1 hover:text-[color:var(--ed-accent-2)]"
                style={{ color: 'var(--ed-fg-soft)' }}
              >
                ↳ Get tickets <span aria-hidden>↗</span>
              </a>
            )}
            <div className="mt-4 border-t border-[color:var(--ed-line)] pt-4">
              <CalendarReactions eventId={pinnedEvent.id} />
            </div>
          </div>
        </section>
      )}

      {/* Group events (beyond the pinned one) */}
      {groupEventList.filter((ge) => !ge.isPinned).length > 0 && (
        <section aria-label="Group events">
          <div className="ed-section-head">
            <div className="u-mono opacity-50">[group]</div>
            <h2 className="u-display" style={{ fontSize: 'clamp(1.25rem, 4vw, 2.5rem)', margin: 0 }}>
              Also in this group
            </h2>
          </div>
          <ul className="mt-4 space-y-2">
            {groupEventList
              .filter((ge) => !ge.isPinned)
              .map((ge) => (
                <li key={ge.groupEventId} className="ed-card p-4">
                  <div className="font-medium">{ge.event.title}</div>
                  <div className="u-mono opacity-60 mt-1">
                    {ge.event.venue ?? 'Venue TBA'}
                    {ge.event.startsAt
                      ? ` · ${new Date(ge.event.startsAt).toLocaleString('en-NZ', {
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'Pacific/Auckland',
                        })}`
                      : ''}
                  </div>
                  <div className="mt-3 border-t border-[color:var(--ed-line)] pt-3">
                    <CalendarReactions eventId={ge.event.id} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Public events — tap to add */}
      <section aria-label="Browse and add events">
        <div className="ed-section-head">
          <div className="u-mono opacity-50">[discover]</div>
          <h2 className="u-display" style={{ fontSize: 'clamp(1.25rem, 4vw, 2.5rem)', margin: 0 }}>
            Add from calendar
          </h2>
          <div className="u-mono opacity-50">{String(dedupedUpcoming.length).padStart(2, '0')} events</div>
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-px bg-[color:var(--ed-line)] border border-[color:var(--ed-line)] sm:grid-cols-2">
          {dedupedUpcoming.map((e) => (
            <li key={e.id} className="ed-card p-4 sm:p-5 flex flex-col gap-2" style={{ border: 0 }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="u-mono opacity-60 mt-1 text-sm">
                    {e.venue ?? 'Venue TBA'}
                    {e.startsAt
                      ? ` · ${new Date(e.startsAt).toLocaleString('en-NZ', {
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'Pacific/Auckland',
                        })}`
                      : ''}
                  </div>
                </div>
                <AddEventButton
                  groupId={uuid}
                  eventId={e.id}
                  alreadyAdded={groupEventIds.has(e.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
