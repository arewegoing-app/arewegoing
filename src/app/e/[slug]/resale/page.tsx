import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, ensureMigrated } from '@/lib/db/client';
import { events, owed, purchases, resaleListings } from '@/lib/db/schema';
import { now } from '@/lib/time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClaimResaleForm } from './claim-form';

export const dynamic = 'force-dynamic';

export default async function ResalePage({ params }: { params: Promise<{ slug: string }> }) {
  await ensureMigrated();
  const { slug } = await params;

  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) notFound();

  const [listing] = await db
    .select()
    .from(resaleListings)
    .where(and(eq(resaleListings.eventId, event.id), eq(resaleListings.state, 'open'))!)
    .limit(1);

  if (!listing) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>No resale tickets right now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>{event.title}</strong> doesn&apos;t have any tickets up for resale right now.
            </p>
            <p>
              <Link href="/" className="text-foreground underline">
                ← back to calendar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Look up the owed amount so we can quote it.
  const [owedRow] = await db
    .select({ amountCents: owed.amountCents })
    .from(owed)
    .innerJoin(purchases, eq(purchases.id, owed.purchaseId))
    .where(and(eq(owed.eventInviteId, listing.originalInviteId), eq(purchases.eventId, event.id))!)
    .limit(1);
  const amountCents = owedRow?.amountCents ?? 0;
  const expired = listing.expiresAt.getTime() < now();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <Badge className="w-fit bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            🎟️ Resale ticket
          </Badge>
          <CardTitle>{event.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {event.venue ?? '—'} ·{' '}
            {event.startsAt
              ? new Date(event.startsAt).toLocaleString('en-NZ', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'Pacific/Auckland',
                })
              : 'TBD'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-card p-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Price</span>
              <span className="font-mono text-base">
                {amountCents > 0 ? `$${(amountCents / 100).toFixed(2)}` : 'ask the buyer'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Listing closes</span>
              <span>
                {listing.expiresAt.toLocaleString('en-NZ', {
                  timeZone: 'Pacific/Auckland',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>

          {expired ? (
            <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              This listing has expired.
            </p>
          ) : (
            <ClaimResaleForm eventId={event.id} eventTitle={event.title} />
          )}

          <p className="text-xs text-muted-foreground">
            First-come, first-served. The original pledger is on the hook until someone takes the ticket.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
