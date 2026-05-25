import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/app/gigs/lib/db/client';
import { events } from '@/app/gigs/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JoinForm } from './join-form';

export const dynamic = 'force-dynamic';

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  await ensureMigrated();
  const { slug } = await params;
  const sp = await searchParams;

  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) notFound();

  if (!sp.t || !event.publicInviteToken || event.publicInviteToken !== sp.t) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-8 text-center text-sm text-destructive">
          This invite link is invalid or has been revoked. Ask the organiser for a fresh link.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>{event.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {event.venue ?? '—'}
            {event.startsAt
              ? ' · ' +
                new Date(event.startsAt).toLocaleString('en-NZ', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'Pacific/Auckland',
                })
              : ' · TBD'}
          </p>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            You&apos;ve been invited via shared link. Drop your name + email and we&apos;ll send
            you back a personal RSVP page you can bookmark.
          </p>
          <JoinForm eventId={event.id} publicToken={sp.t} eventTitle={event.title} />
        </CardContent>
      </Card>
    </div>
  );
}
