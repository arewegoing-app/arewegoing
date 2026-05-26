import Link from 'next/link';
import { eq, or, desc } from 'drizzle-orm';
import { BookmarkIcon, CalendarIcon } from 'lucide-react';
import { auth } from '@/lib/auth/auth';
import { readAnonId } from '@/lib/anon/identity';
import { db, ensureMigrated } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MyEventsPage() {
  await ensureMigrated();
  const session = await auth();
  const anonId = await readAnonId();

  const userId = session?.user?.id ?? null;
  if (!userId && !anonId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your gigs</h1>
        <Card>
          <CardContent className="mx-auto max-w-md py-12 text-center">
            <h2 className="text-base font-medium">No gigs claimed yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a gig from the calendar and hit &quot;Ready to rally&quot;. We&apos;ll remember
              it on this device.
            </p>
            <Link href="/" className={cn(buttonVariants(), 'mt-4')}>
              <CalendarIcon aria-hidden="true" /> Open the calendar
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usingAnon = !userId && !!anonId;

  const filters = [
    userId ? eq(events.ownerUserId, userId) : undefined,
    anonId ? eq(events.anonOwnerId, anonId) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];

  const mine = await db
    .select()
    .from(events)
    .where(filters.length > 1 ? or(...filters) : filters[0])
    .orderBy(desc(events.createdAt));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your gigs</h1>
          <p className="text-sm text-muted-foreground">
            Bookmark this URL — it&apos;s how you find these again.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
          <CalendarIcon aria-hidden="true" /> Calendar
        </Link>
      </header>

      {usingAnon && (
        <div
          className="flex items-start gap-3 rounded-md border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200"
          role="note"
        >
          <BookmarkIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <strong>Bookmark this page.</strong> You&apos;re identified by a cookie on this device.
            Clear your cookies or switch browsers and you&apos;ll lose access — bookmark the URL or
            email it to yourself.
          </div>
        </div>
      )}

      {mine.length === 0 ? (
        <Card>
          <CardContent className="mx-auto max-w-md py-12 text-center">
            <h2 className="text-base font-medium">No gigs claimed yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Anything you rally or create from the calendar will land here.
            </p>
            <Link href="/" className={cn(buttonVariants(), 'mt-4')}>
              <CalendarIcon aria-hidden="true" /> Open the calendar
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Your gigs">
          {mine.map((e) => (
            <li key={e.id}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardHeader className="space-y-1">
                  <Link href={`/gigs/e/${e.slug}`} className="font-medium hover:underline">
                    {e.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {e.venue ?? '—'} ·{' '}
                    {e.startsAt
                      ? new Date(e.startsAt).toLocaleDateString('en-NZ', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })
                      : 'TBD'}
                  </p>
                  {e.seriesName && (
                    <Badge variant="secondary" className="mt-1 w-fit">
                      {e.seriesName}
                    </Badge>
                  )}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
