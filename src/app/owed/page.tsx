import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { CalendarIcon } from 'lucide-react';
import { auth } from '@/lib/auth/auth';
import { db, ensureMigrated } from '@/lib/db/client';
import { eventInvites, events, owed, purchases, recipients } from '@/lib/db/schema';
import { Avatar } from '@/components/avatar';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function OwedSummaryPage() {
  await ensureMigrated();
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const userId = session.user.id;

  const rows = await db
    .select({
      owedId: owed.id,
      paid: owed.paid,
      amountCents: owed.amountCents,
      purchaseCreatedAt: purchases.createdAt,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStartsAt: events.startsAt,
      recipientId: recipients.id,
      recipientName: recipients.displayName,
      recipientEmail: recipients.email,
    })
    .from(owed)
    .innerJoin(purchases, eq(purchases.id, owed.purchaseId))
    .innerJoin(eventInvites, eq(eventInvites.id, owed.eventInviteId))
    .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .innerJoin(events, eq(events.id, purchases.eventId))
    .where(eq(purchases.buyerUserId, userId))
    .orderBy(sql`${purchases.createdAt} desc`);

  const now = Date.now();

  // Per-recipient roll-up.
  type PerRecipient = {
    recipientId: string;
    name: string;
    email: string;
    totalOwed: number;
    totalPaid: number;
    rowCount: number;
    unpaidEvents: { slug: string; title: string; amount: number; days: number }[];
  };
  const perRecipient = new Map<string, PerRecipient>();
  for (const r of rows) {
    let bucket = perRecipient.get(r.recipientId);
    if (!bucket) {
      bucket = {
        recipientId: r.recipientId,
        name: r.recipientName,
        email: r.recipientEmail,
        totalOwed: 0,
        totalPaid: 0,
        rowCount: 0,
        unpaidEvents: [],
      };
      perRecipient.set(r.recipientId, bucket);
    }
    bucket.rowCount++;
    if (r.paid === 1) {
      bucket.totalPaid += r.amountCents;
    } else {
      bucket.totalOwed += r.amountCents;
      bucket.unpaidEvents.push({
        slug: r.eventSlug,
        title: r.eventTitle,
        amount: r.amountCents,
        days: Math.max(0, Math.floor((now - new Date(r.purchaseCreatedAt).getTime()) / 86_400_000)),
      });
    }
  }

  const sorted = [...perRecipient.values()].sort((a, b) => b.totalOwed - a.totalOwed);
  const totalOutstanding = sorted.reduce((s, r) => s + r.totalOwed, 0);
  const totalReceived = sorted.reduce((s, r) => s + r.totalPaid, 0);
  const totalFronted = totalOutstanding + totalReceived;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owed to you</h1>
          <p className="text-sm text-muted-foreground">
            Running roll-up across every event you&apos;ve bought tickets for.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
          <CalendarIcon aria-hidden="true" /> Calendar
        </Link>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="mx-auto max-w-md py-12 text-center">
            <h2 className="text-base font-medium">Nobody owes you anything</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Record a ticket purchase on an event you&apos;re organizing. The split per friend
              shows up here.
            </p>
            <Link href="/organizing" className={cn(buttonVariants(), 'mt-4')}>
              Find an event to invoice
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Fronted" value={fmtCents(totalFronted)} />
            <Stat label="Received" value={fmtCents(totalReceived)} />
            <Stat label="Outstanding" value={fmtCents(totalOutstanding)} highlight />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By person</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Owed</TableHead>
                    <TableHead className="hidden sm:table-cell">Paid</TableHead>
                    <TableHead className="hidden md:table-cell">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow key={r.recipientId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar name={r.name} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate">{r.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={r.totalOwed > 0 ? 'font-semibold' : 'text-muted-foreground'}>
                        {fmtCents(r.totalOwed)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{fmtCents(r.totalPaid)}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {r.unpaidEvents.length === 0 ? (
                          'all paid'
                        ) : (
                          <ul className="space-y-0.5">
                            {r.unpaidEvents.slice(0, 3).map((e) => (
                              <li key={e.slug}>
                                <Link href={`/gigs/e/${e.slug}`} className="hover:underline">
                                  {e.title}
                                </Link>{' '}
                                ({e.days}d)
                              </li>
                            ))}
                            {r.unpaidEvents.length > 3 && <li>+{r.unpaidEvents.length - 3} more</li>}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-md border bg-card p-3', highlight && 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40')}>
      <div className={cn('font-mono text-lg', highlight && 'text-amber-900 dark:text-amber-200')}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
