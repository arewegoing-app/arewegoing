import Link from 'next/link';
import { eq, or, desc } from 'drizzle-orm';
import { CalendarIcon } from 'lucide-react';
import { auth } from '../lib/auth/auth';
import { readAnonId } from '../lib/anon/identity';
import { db, ensureMigrated } from '../lib/db/client';
import { events } from '../lib/db/schema';
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
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing here yet. Open the{' '}
            <Link href="/gigs" className="text-foreground underline">
              calendar
            </Link>{' '}
            and rally a gig — we&apos;ll remember it for you.
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <Link href="/gigs" className={cn(buttonVariants({ variant: 'outline' }))}>
          <CalendarIcon aria-hidden="true" /> Calendar
        </Link>
      </header>

      {mine.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You haven&apos;t rallied any gigs yet. Tap{' '}
            <Link href="/gigs" className="text-foreground underline">
              the calendar
            </Link>{' '}
            and claim one.
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
