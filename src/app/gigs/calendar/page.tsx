import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, asc, gte, lte, or, isNull, eq, sql } from 'drizzle-orm';
import { auth } from '../lib/auth/auth';
import { db } from '../lib/db/client';
import { events } from '../lib/db/schema';
import { getReactionTallies } from '../lib/discovery/reactions';
import { CalendarReactions } from './reactions-row';
import { PromoteToRallyForm } from './promote-form';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ reaction?: string; event?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/gigs/signin');
  const sp = await searchParams;

  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const upcoming = await db
    .select()
    .from(events)
    .where(
      and(
        or(isNull(events.ownerUserId), eq(events.ownerUserId, session.user.id))!,
        gte(events.startsAt, now),
        lte(events.startsAt, ninetyDaysOut),
      )!,
    )
    .orderBy(asc(events.startsAt));

  const tallies = await getReactionTallies(upcoming.map((e) => e.id));

  const grouped = groupByWeek(upcoming);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Next 90 days</h1>
        <Link href="/gigs" className="text-sm text-neutral-400 hover:text-neutral-200">← back to events</Link>
      </header>

      {sp.reaction && (
        <div className="rounded bg-emerald-900/40 border border-emerald-700 px-4 py-2 text-sm">
          Reaction recorded: <strong>{sp.reaction}</strong>{sp.event ? ` on ${sp.event}` : ''}
        </div>
      )}

      {upcoming.length === 0 && (
        <div className="rounded border border-neutral-800 p-6 text-sm text-neutral-400">
          No upcoming events yet. Run the discovery cron at <code className="text-neutral-300">/gigs/api/cron/discover</code> to pull from the seed feeds.
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(({ weekStart, items }) => (
          <section key={weekStart.toISOString()}>
            <h2 className="text-sm font-medium text-neutral-400 mb-2">
              Week of {weekStart.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
            </h2>
            <ul className="space-y-2">
              {items.map((e) => {
                const t = tallies.get(e.id) ?? { interested: 0, down: 0, cant: 0, pledge_1: 0, pledge_2: 0 };
                const downCount = t.down + t.pledge_1 + t.pledge_2;
                const readyToRally = downCount >= 3 && !e.ownerUserId;
                return (
                  <li key={e.id} className="rounded border border-neutral-800 p-4 space-y-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <div className="font-medium">
                          {e.ownerUserId ? (
                            <Link href={`/gigs/e/${e.slug}`} className="hover:text-emerald-400">{e.title}</Link>
                          ) : (
                            e.title
                          )}
                        </div>
                        <div className="text-sm text-neutral-400">
                          {e.venue ?? '—'} · {e.startsAt ? new Date(e.startsAt).toLocaleString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                          {e.priceLow ? ` · from $${e.priceLow}` : ''}
                          {e.seriesName ? ` · ${e.seriesName}` : ''}
                        </div>
                        {e.ticketUrl && (
                          <a href={e.ticketUrl} target="_blank" rel="noreferrer" className="text-xs text-neutral-500 hover:text-neutral-300">{shortUrl(e.ticketUrl)} ↗</a>
                        )}
                      </div>
                      <div className="text-right text-xs text-neutral-400 whitespace-nowrap">
                        {t.interested > 0 && <span className="mr-2">👀 {t.interested}</span>}
                        {t.down > 0 && <span className="mr-2">✅ {t.down}</span>}
                        {(t.pledge_1 + t.pledge_2) > 0 && <span className="mr-2">🎫 {t.pledge_1 + t.pledge_2}</span>}
                        {t.cant > 0 && <span>❌ {t.cant}</span>}
                      </div>
                    </div>
                    <CalendarReactions eventId={e.id} />
                    {readyToRally && <PromoteToRallyForm eventId={e.id} />}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupByWeek(items: { startsAt: Date | null }[] & typeof events.$inferSelect[] | Array<typeof events.$inferSelect>): { weekStart: Date; items: Array<typeof events.$inferSelect> }[] {
  const buckets = new Map<string, { weekStart: Date; items: Array<typeof events.$inferSelect> }>();
  for (const item of items) {
    if (!item.startsAt) continue;
    const d = new Date(item.startsAt);
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString();
    if (!buckets.has(key)) buckets.set(key, { weekStart: monday, items: [] });
    buckets.get(key)!.items.push(item);
  }
  return [...buckets.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

function shortUrl(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

void sql;
