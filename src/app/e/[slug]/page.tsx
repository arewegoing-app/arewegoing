import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { checkEventOwner } from '@/lib/auth/owner';
import { db, ensureMigrated } from '@/lib/db/client';
import {
  events,
  eventInvites,
  finalCalls,
  groupMembers,
  owed,
  pledgeCommitments,
  promoOutreach,
  purchases,
  recipients,
  resaleListings,
  rsvps,
} from '@/lib/db/schema';
import { getReliabilityStats } from '@/lib/memory/stats';
import { now } from '@/lib/time';
import { listMyGroups } from '@/lib/groups/actions';
import type { GroupWithCount } from '@/lib/groups/actions';
import { PromoPanel } from './promo-panel';
import { InviteForm } from './invite-form';
import type { ReliabilityStatsMap } from './invite-form';
import { FinalCallForm } from './final-call-form';
import { ShareButtons } from './share-buttons';
import { PublicInviteToggle } from './public-invite-toggle';
import { OwedDashboard } from './owed-dashboard';
import { Avatar } from '@/components/avatar';

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
      <div className="ed-card mx-auto max-w-lg p-6 text-center">
        <div className="u-mono opacity-50">[!] / Not your event</div>
        <h1 className="u-display mt-2 text-2xl">Organised by someone else.</h1>
        <p className="u-mono mt-3 opacity-70 leading-relaxed">
          Ask them to share, or head back to the{' '}
          <Link href="/" className="underline hover:text-[color:var(--ed-accent-2)]">
            calendar
          </Link>{' '}
          to see what&apos;s on.
        </p>
      </div>
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

  // Groups — used to power the group filter in InviteForm.
  let myGroups: GroupWithCount[] = [];
  const groupMembersMap: Record<string, string[]> = {};
  try {
    myGroups = await listMyGroups();
    // Build a map of groupId → recipientIds so InviteForm can filter client-side.
    if (myGroups.length >= 2 && uninvited.length > 0) {
      const groupIds = myGroups.map((g) => g.id);
      const uninvitedIds = uninvited.map((r) => r.id);
      const memberRows = await db
        .select({ groupId: groupMembers.groupId, recipientId: groupMembers.recipientId })
        .from(groupMembers)
        .where(
          and(
            inArray(groupMembers.groupId, groupIds),
            inArray(groupMembers.recipientId, uninvitedIds),
          ),
        );
      for (const row of memberRows) {
        if (!groupMembersMap[row.groupId]) groupMembersMap[row.groupId] = [];
        groupMembersMap[row.groupId].push(row.recipientId);
      }
    }
  } catch {
    // no_identity in some auth states — safe to skip
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

  const nowMs = now();
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
    daysOutstanding: Math.max(0, Math.floor((nowMs - new Date(r.purchase.createdAt).getTime()) / 86_400_000)),
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
    <div className="space-y-8 sm:space-y-10">
      {/* Hero header — back link, mono meta, big title, share row */}
      <header>
        <Link
          href="/calendar"
          className="u-mono inline-flex items-center hover:text-[color:var(--ed-accent-2)]"
        >
          <span aria-hidden>↳ </span>Back to calendar
        </Link>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-6">
          <div className="u-mono leading-relaxed" style={{ color: 'var(--ed-fg-soft)' }}>
            <span className="block opacity-50">[01] / Venue</span>
            <strong className="block font-medium">{event.venue ?? '—'}</strong>
          </div>
          <div className="u-mono leading-relaxed" style={{ color: 'var(--ed-fg-soft)' }}>
            <span className="block opacity-50">[02] / When</span>
            <strong className="block font-medium">
              {event.startsAt
                ? new Date(event.startsAt).toLocaleString('en-NZ', {
                    timeZone: 'Pacific/Auckland',
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'TBD'}
            </strong>
            {event.priceLow && (
              <span className="block opacity-70">from ${event.priceLow}</span>
            )}
          </div>
        </div>

        <h1
          className="u-display mt-6"
          style={{ fontSize: 'clamp(2rem, 7vw, 5rem)' }}
        >
          {event.title}
        </h1>

        {event.seriesName && (
          <span
            className="u-mono mt-4 inline-block"
            style={{
              background: 'var(--ed-fg)',
              color: 'var(--ed-bg)',
              padding: '0.3rem 0.6rem',
            }}
          >
            {event.seriesName}
          </span>
        )}

        <div className="mt-6">
          <ShareButtons
            eventTitle={event.title}
            eventVenue={event.venue}
            eventDate={
              event.startsAt
                ? new Date(event.startsAt).toLocaleString('en-NZ', {
                    timeZone: 'Pacific/Auckland',
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : null
            }
            eventId={event.id}
            shareUrl={`${process.env.GIGS_APP_URL ?? ''}/e/${event.slug}`}
            icsUrl={`/e/${event.slug}/ics`}
            showRefresh={!!(event.sourceUrl || event.ticketUrl)}
          />
        </div>
      </header>

      {sp.status && (
        <div
          role="status"
          className="border px-4 py-2"
          style={{
            background: 'var(--ed-accent)',
            color: 'var(--ed-fg)',
            borderColor: 'var(--ed-line)',
          }}
        >
          <span className="u-mono opacity-60">↳ RSVP recorded</span>{' '}
          <strong>{sp.status}</strong>
          {sp.replay && ' (already counted)'}
        </div>
      )}
      {sp.pledge && (
        <div
          role="status"
          className="border px-4 py-2"
          style={{
            background: 'var(--ed-accent)',
            color: 'var(--ed-fg)',
            borderColor: 'var(--ed-line)',
          }}
        >
          <span className="u-mono opacity-60">↳ Pledge</span> <strong>{sp.pledge}</strong>
          {sp.replay && ' (already counted)'}
        </div>
      )}

      {/* Stats — hairline grid */}
      <section
        aria-label="RSVP totals"
        className="ed-card grid grid-cols-3 gap-px sm:grid-cols-5"
        style={{ background: 'var(--ed-line)' }}
      >
        <Stat label="Going" value={goingCount} accent />
        <Stat label="Pledged" value={pledgedCount} />
        <Stat label="Maybe" value={maybeCount} />
        <Stat label="Out" value={outCount} />
        <Stat label="Pending" value={pendingCount} />
      </section>

      {goingCount > 0 && !activeCall && (
        <FinalCallForm eventId={event.id} defaultPrice={event.priceLow ?? undefined} />
      )}

      {activeCall && (
        <section
          className="ed-card p-4 sm:p-5"
          style={{ background: 'var(--ed-accent)' }}
        >
          <div className="u-mono opacity-70">[!] / Final call active</div>
          <p className="u-display mt-1 text-2xl">
            ${activeCall.pledgeAmount} per ticket
          </p>
          <p className="u-mono mt-1 opacity-80">
            ↳ Deadline {new Date(activeCall.deadlineAt).toLocaleString('en-NZ')}
          </p>
          <p className="u-mono mt-2">
            {commitments.filter((c) => c.state === 'confirmed').length} confirmed ·{' '}
            {commitments.filter((c) => c.state === 'asked').length} pending ·{' '}
            {commitments.filter((c) => c.state === 'dropped').length} dropped
          </p>
        </section>
      )}

      <PromoPanel
        eventId={event.id}
        initialStatus={promo?.status ?? 'not_asked'}
        initialCode={promo?.code ?? null}
      />

      <PublicInviteToggle
        eventId={event.id}
        eventSlug={event.slug}
        initialToken={event.publicInviteToken ?? null}
        appUrl={process.env.GIGS_APP_URL ?? ''}
      />

      {dashboardRows.length > 0 && <OwedDashboard rows={dashboardRows} totals={totals} />}

      {openListings.length > 0 && (
        <section className="ed-card p-4 sm:p-5">
          <div className="u-mono opacity-50">[!] / Resale open</div>
          <h2 className="u-display mt-1 text-2xl">
            {openListings.length} ticket{openListings.length === 1 ? '' : 's'} up for grabs
          </h2>
          <p className="u-mono mt-2 opacity-70 leading-relaxed">
            ↳ If nobody claims by{' '}
            {new Date(openListings[0].expiresAt).toLocaleString('en-NZ', {
              timeZone: 'Pacific/Auckland',
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            , the original pledger remains on the hook.
          </p>
        </section>
      )}

      {/* Invited section */}
      <section aria-label="Invited people">
        <div className="ed-section-head">
          <div className="u-mono opacity-50">[03] / Invited</div>
          <h2 className="u-display" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', margin: 0 }}>
            Who&apos;s in
          </h2>
          <div className="u-mono opacity-50">
            {String(invitesRows.length).padStart(2, '0')} people
          </div>
        </div>
        {invitesRows.length === 0 ? (
          <div className="ed-card mt-4 p-6 text-center">
            <p className="u-mono opacity-60">↳ Nobody invited yet.</p>
          </div>
        ) : (
          <ul className="ed-card mt-4 divide-y divide-[color:var(--ed-line)]">
            {invitesRows.map(({ invite, recipient, rsvp }) => {
              const c = commitmentByInvite.get(invite.id);
              const hasOwn = invite.hasOwnTicket === 1;
              const pledgeBadge = hasOwn
                ? 'has own ticket'
                : rsvp?.pledgeState === 'locked'
                  ? 'locked'
                  : rsvp?.pledgeState === 'pledged'
                    ? 'pledged'
                    : c?.state === 'asked'
                      ? 'awaiting pledge'
                      : c?.state === 'dropped'
                        ? 'dropped'
                        : null;
              return (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={recipient?.displayName ?? '?'} size="sm" />
                    <span className="truncate">
                      <strong>{recipient?.displayName}</strong>{' '}
                      <span className="u-mono" style={{ color: 'var(--ed-fg-soft)' }}>
                        ({recipient?.email})
                      </span>
                    </span>
                  </span>
                  <span
                    className="u-mono"
                    style={{ color: 'var(--ed-fg-soft)' }}
                  >
                    ↳ {rsvp?.status ?? 'pending'}
                    {pledgeBadge && <span> · {pledgeBadge}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Invite form */}
      <section aria-label="Invite people">
        <div className="ed-section-head">
          <div className="u-mono opacity-50">[04] / Invite</div>
          <h2 className="u-display" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', margin: 0 }}>
            Pull friends in
          </h2>
          <div className="u-mono opacity-50">
            {String(uninvited.length).padStart(2, '0')} not yet asked
          </div>
        </div>
        <div className="ed-card mt-4 p-4 sm:p-5">
          <InviteForm
            eventId={event.id}
            recipients={uninvited}
            reliabilityStats={reliabilityStats}
            groups={myGroups}
            groupMembers={groupMembersMap}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="p-3 text-center"
      style={{
        background: accent && value > 0 ? 'var(--ed-accent)' : 'var(--ed-bg)',
      }}
    >
      <div className="u-display tabular-nums" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="u-mono opacity-60">{label}</div>
    </div>
  );
}
