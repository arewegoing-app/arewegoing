import { notFound } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/app/gigs/lib/auth/auth';
import { checkEventOwner } from '@/app/gigs/lib/auth/owner';
import { db, ensureMigrated } from '@/app/gigs/lib/db/client';
import {
  events,
  eventInvites,
  finalCalls,
  owed,
  pledgeCommitments,
  promoOutreach,
  purchases,
  recipients,
  resaleListings,
  rsvps,
} from '@/app/gigs/lib/db/schema';
import { getReliabilityStats } from '@/app/gigs/lib/memory/stats';
import { PromoPanel } from './promo-panel';
import { InviteForm } from './invite-form';
import type { ReliabilityStatsMap } from './invite-form';
import { FinalCallForm } from './final-call-form';
import { ShareButtons } from './share-buttons';
import { OwedDashboard } from './owed-dashboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '../../components/avatar';

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; replay?: string; pledge?: string }>;
}) {
  await ensureMigrated();
  const { slug } = await params;
  const sp = await searchParams;

  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) notFound();

  const ownerCheck = await checkEventOwner(event);
  if (!ownerCheck.isOwner) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This event is being organised by someone else. Ask them to share the calendar with you, or go to the{' '}
          <a href="/gigs" className="text-foreground underline">calendar</a> to see what&apos;s on.
        </CardContent>
      </Card>
    );
  }

  const session = await auth();
  const invitesRows = await db
    .select({ invite: eventInvites, recipient: recipients, rsvp: rsvps })
    .from(eventInvites)
    .leftJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .leftJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
    .where(eq(eventInvites.eventId, event.id));

  // Address book of recipients — load by whichever ownership the current viewer matches.
  const allRecipients = ownerCheck.via === 'user'
    ? await db.select().from(recipients).where(eq(recipients.ownerUserId, ownerCheck.userId!))
    : await db.select().from(recipients).where(eq(recipients.anonOwnerId, ownerCheck.anonId!));
  const invitedIds = new Set(invitesRows.map((r) => r.recipient?.id));
  const uninvited = allRecipients.filter((r) => !invitedIds.has(r.id));

  // Reliability stats — computed for authenticated buyers only.
  // Anon owners have no cross-event history, so skip the query.
  let reliabilityStats: ReliabilityStatsMap | undefined;
  if (ownerCheck.via === 'user' && ownerCheck.userId && uninvited.length > 0) {
    const statsMap = await getReliabilityStats(
      { buyerUserId: ownerCheck.userId },
      uninvited.map((r) => r.id),
    );
    reliabilityStats = Object.fromEntries(statsMap);
  }

  const goingCount = invitesRows.filter((r) => r.rsvp?.status === 'going').length;
  const maybeCount = invitesRows.filter((r) => r.rsvp?.status === 'maybe').length;
  const outCount = invitesRows.filter((r) => r.rsvp?.status === 'out').length;
  const pendingCount = invitesRows.length - goingCount - maybeCount - outCount;
  const pledgedCount = invitesRows.filter(
    (r) => r.rsvp?.pledgeState === 'pledged' || r.rsvp?.pledgeState === 'locked',
  ).length;

  const [activeCall] = await db
    .select()
    .from(finalCalls)
    .where(and(eq(finalCalls.eventId, event.id), eq(finalCalls.status, 'pending'))!)
    .orderBy(sql`triggered_at desc`)
    .limit(1);

  const commitments = activeCall
    ? await db.select().from(pledgeCommitments).where(eq(pledgeCommitments.finalCallId, activeCall.id))
    : [];
  const commitmentByInvite = new Map(commitments.map((c) => [c.eventInviteId, c]));

  const purchasesForEvent = await db
    .select()
    .from(purchases)
    .where(eq(purchases.eventId, event.id));
  const purchaseIds = purchasesForEvent.map((p) => p.id);

  const owedRows = purchaseIds.length
    ? await db
        .select({ owed: owed, recipient: recipients, purchase: purchases })
        .from(owed)
        .innerJoin(eventInvites, eq(eventInvites.id, owed.eventInviteId))
        .innerJoin(recipients, eq(recipients.id, eventInvites.recipientId))
        .innerJoin(purchases, eq(purchases.id, owed.purchaseId))
        .where(eq(purchases.eventId, event.id))
    : [];

  const now = Date.now();
  const openListings = await db
    .select()
    .from(resaleListings)
    .where(and(eq(resaleListings.eventId, event.id), eq(resaleListings.state, 'open'))!);

  const [promo] = await db.select().from(promoOutreach).where(eq(promoOutreach.eventId, event.id)).limit(1);

  const rsvpByInvite = new Map(
    (await db
      .select()
      .from(rsvps)).map((r) => [r.eventInviteId, r]),
  );
  const dashboardRows = owedRows.map((r) => ({
    owedId: r.owed.id,
    inviteId: r.owed.eventInviteId,
    recipientName: r.recipient.displayName,
    recipientEmail: r.recipient.email,
    amountCents: r.owed.amountCents,
    paid: r.owed.paid === 1,
    daysOutstanding: Math.max(0, Math.floor((now - new Date(r.purchase.createdAt).getTime()) / 86_400_000)),
    lastRemindedAt: r.owed.lastRemindedAt,
    bailed: rsvpByInvite.get(r.owed.eventInviteId)?.pledgeState === 'bailed',
  }));
  const totals = dashboardRows.reduce(
    (acc, r) => ({
      fronted: acc.fronted + r.amountCents,
      received: acc.received + (r.paid ? r.amountCents : 0),
      outstanding: acc.outstanding + (r.paid ? 0 : r.amountCents),
    }),
    { fronted: 0, received: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="text-sm text-muted-foreground">
            {event.venue ?? '—'} ·{' '}
            {event.startsAt ? new Date(event.startsAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'full', timeStyle: 'short' }) : 'TBD'}
            {event.priceLow ? ` · from $${event.priceLow}` : ''}
          </p>
          {event.seriesName && (
            <Badge variant="secondary" className="mt-1">
              {event.seriesName}
            </Badge>
          )}
        </div>
        <ShareButtons
          eventTitle={event.title}
          eventVenue={event.venue}
          eventDate={event.startsAt ? new Date(event.startsAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null}
          eventId={event.id}
          shareUrl={`${process.env.GIGS_APP_URL ?? ''}/gigs/e/${event.slug}`}
          icsUrl={`/gigs/e/${event.slug}/ics`}
          showRefresh={!!(event.sourceUrl || event.ticketUrl)}
        />
      </header>

      {sp.status && (
        <div
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          RSVP recorded: <strong>{sp.status}</strong>
          {sp.replay && ' (already counted)'}
        </div>
      )}
      {sp.pledge && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Pledge {sp.pledge}{sp.replay && ' (already counted)'}
        </div>
      )}

      <section className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Stat label="Going" value={goingCount} />
        <Stat label="Pledged" value={pledgedCount} />
        <Stat label="Maybe" value={maybeCount} />
        <Stat label="Out" value={outCount} />
        <Stat label="Pending" value={pendingCount} />
      </section>

      {goingCount > 0 && !activeCall && (
        <FinalCallForm eventId={event.id} defaultPrice={event.priceLow ?? undefined} />
      )}

      {activeCall && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40">
          <CardHeader>
            <CardTitle className="text-sm text-amber-900 dark:text-amber-200">Final call active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-amber-900 dark:text-amber-200">
            <p>
              ${activeCall.pledgeAmount} per ticket · deadline{' '}
              {new Date(activeCall.deadlineAt).toLocaleString('en-NZ')}
            </p>
            <p className="text-muted-foreground">
              {commitments.filter((c) => c.state === 'confirmed').length} confirmed,{' '}
              {commitments.filter((c) => c.state === 'asked').length} pending,{' '}
              {commitments.filter((c) => c.state === 'dropped').length} dropped
            </p>
          </CardContent>
        </Card>
      )}

      <PromoPanel
        eventId={event.id}
        initialStatus={promo?.status ?? 'not_asked'}
        initialCode={promo?.code ?? null}
      />

      {dashboardRows.length > 0 && <OwedDashboard rows={dashboardRows} totals={totals} />}

      {openListings.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-900/50">
          <CardHeader>
            <CardTitle className="text-sm">{openListings.length} ticket{openListings.length === 1 ? '' : 's'} up for resale</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The resale offer has gone out. If nobody claims by{' '}
            {new Date(openListings[0].expiresAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' })}
            , the original pledger remains on the hook.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invited</CardTitle>
        </CardHeader>
        <CardContent>
          {invitesRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody invited yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {invitesRows.map(({ invite, recipient, rsvp }) => {
                const c = commitmentByInvite.get(invite.id);
                const hasOwn = invite.hasOwnTicket === 1;
                const pledgeBadge = hasOwn
                  ? '🎟️ has own ticket'
                  : rsvp?.pledgeState === 'locked'
                    ? '🔒 locked'
                    : rsvp?.pledgeState === 'pledged'
                      ? '💵 pledged'
                      : c?.state === 'asked'
                        ? '⏳ awaiting pledge'
                        : c?.state === 'dropped'
                          ? '🚪 dropped'
                          : null;
                return (
                  <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={recipient?.displayName ?? '?'} size="sm" />
                      <span className="truncate">
                        {recipient?.displayName}{' '}
                        <span className="text-muted-foreground">({recipient?.email})</span>
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {rsvp?.status ?? 'pending'}
                      {pledgeBadge && <span className="ml-2">{pledgeBadge}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite people</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm eventId={event.id} recipients={uninvited} reliabilityStats={reliabilityStats} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-3 text-center">
      <div className="font-mono text-xl">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
