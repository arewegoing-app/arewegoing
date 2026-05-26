import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { events } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default async function OrganizingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const list = await db
    .select()
    .from(events)
    .where(and(eq(events.ownerUserId, session.user.id))!)
    .orderBy(desc(events.createdAt));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events you&apos;re organizing</h1>
          <p className="text-sm text-muted-foreground">Anything you&apos;ve created or claimed from the calendar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
            <CalendarIcon aria-hidden="true" /> Calendar
          </Link>
          <Link href="/new" className={cn(buttonVariants())}>
            <PlusIcon aria-hidden="true" /> New event
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardContent className="mx-auto max-w-md py-12 text-center">
            <h2 className="text-base font-medium">You&apos;re not organizing anything yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Claim a gig from the calendar or create a new event. It&apos;ll show up here so you
              can invite friends.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
                <CalendarIcon aria-hidden="true" /> Open the calendar
              </Link>
              <Link href="/new" className={cn(buttonVariants())}>
                <PlusIcon aria-hidden="true" /> Create an event
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Events you're organizing">
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
