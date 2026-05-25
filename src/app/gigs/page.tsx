import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { auth } from './lib/auth/auth';
import { db } from './lib/db/client';
import { events } from './lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default async function GigsHome() {
  const session = await auth();
  if (!session?.user?.id) redirect('/gigs/signin');
  const list = await db
    .select()
    .from(events)
    .where(and(eq(events.ownerUserId, session.user.id))!)
    .orderBy(desc(events.createdAt));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/gigs/calendar" className={cn(buttonVariants({ variant: 'outline' }))}>
            <CalendarIcon aria-hidden="true" /> Calendar
          </Link>
          <Link href="/gigs/new" className={cn(buttonVariants())}>
            <PlusIcon aria-hidden="true" /> New event
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No events yet. Create one to rally your crew, or check the{' '}
            <Link href="/gigs/calendar" className="text-foreground underline">
              calendar
            </Link>{' '}
            for upcoming Wellington gigs.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Your events">
          {list.map((e) => (
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
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
