import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/app/gigs/lib/db/client';
import { events, eventInvites, recipients, rsvpConditions, rsvps } from '@/app/gigs/lib/db/schema';
import { verifyToken } from '@/app/gigs/lib/tokens/token-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RespondForm } from './respond-form';

export const dynamic = 'force-dynamic';

export default async function RespondPage({
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

  if (!sp.t) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          This page needs a personal link — check your email.
        </CardContent>
      </Card>
    );
  }

  const verified = verifyToken(sp.t);
  if (!verified.ok || verified.payload.eid !== event.id) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-8 text-center text-sm text-destructive">
          Link is expired or invalid. Ask the organiser to resend.
        </CardContent>
      </Card>
    );
  }

  const [invite] = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.recipientId, verified.payload.rid), eq(eventInvites.eventId, event.id))!)
    .limit(1);
  if (!invite) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="py-8 text-center text-sm text-destructive">
          We don&apos;t have an invite for you on this event.
        </CardContent>
      </Card>
    );
  }

  const [recipient] = await db.select().from(recipients).where(eq(recipients.id, verified.payload.rid)).limit(1);
  const [rsvp] = await db.select().from(rsvps).where(eq(rsvps.eventInviteId, invite.id)).limit(1);
  const conditions = await db.select().from(rsvpConditions).where(eq(rsvpConditions.eventInviteId, invite.id));

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
            {event.priceLow ? ` · from $${event.priceLow}` : ''}
          </p>
          {recipient && (
            <Badge variant="secondary" className="w-fit">
              Responding as {recipient.displayName}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <RespondForm
            eventInviteId={invite.id}
            currentStatus={rsvp?.status ?? null}
            currentConditions={conditions.map((c) => {
              if (c.kind === 'requires_promo') {
                return { kind: 'requires_promo' as const, value: !!c.boolValue, satisfied: c.satisfied === 1 };
              }
              if (c.kind === 'min_going') {
                return { kind: 'min_going' as const, value: c.intValue ?? 0, satisfied: c.satisfied === 1 };
              }
              return { kind: 'price_ceiling' as const, value: c.intValue ?? 0, satisfied: c.satisfied === 1 };
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
