import { notFound, redirect } from 'next/navigation';
import { eq, and, sql } from 'drizzle-orm';
import { auth } from '@/app/gigs/lib/auth/auth';
import { db } from '@/app/gigs/lib/db/client';
import { events, eventInvites, finalCalls, pledgeCommitments, recipients, rsvps } from '@/app/gigs/lib/db/schema';
import { InviteForm } from './invite-form';
import { FinalCallForm } from './final-call-form';

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; replay?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/gigs/signin');
  const { slug } = await params;
  const sp = await searchParams;

  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) notFound();
  if (event.ownerUserId !== session.user.id) {
    return <div>Not your event.</div>;
  }

  const invitesRows = await db
    .select({
      invite: eventInvites,
      recipient: recipients,
      rsvp: rsvps,
    })
    .from(eventInvites)
    .leftJoin(recipients, eq(recipients.id, eventInvites.recipientId))
    .leftJoin(rsvps, eq(rsvps.eventInviteId, eventInvites.id))
    .where(eq(eventInvites.eventId, event.id));

  const allRecipients = await db.select().from(recipients).where(eq(recipients.ownerUserId, session.user.id));
  const invitedIds = new Set(invitesRows.map((r) => r.recipient?.id));
  const uninvited = allRecipients.filter((r) => !invitedIds.has(r.id));

  const goingCount = invitesRows.filter((r) => r.rsvp?.status === 'going').length;
  const maybeCount = invitesRows.filter((r) => r.rsvp?.status === 'maybe').length;
  const outCount = invitesRows.filter((r) => r.rsvp?.status === 'out').length;
  const pendingCount = invitesRows.length - goingCount - maybeCount - outCount;
  const pledgedCount = invitesRows.filter((r) => r.rsvp?.pledgeState === 'pledged' || r.rsvp?.pledgeState === 'locked').length;

  const [activeCall] = await db
    .select()
    .from(finalCalls)
    .where(and(eq(finalCalls.eventId, event.id), eq(finalCalls.status, 'pending')))
    .orderBy(sql`triggered_at desc`)
    .limit(1);

  const commitments = activeCall
    ? await db.select().from(pledgeCommitments).where(eq(pledgeCommitments.finalCallId, activeCall.id))
    : [];
  const commitmentByInvite = new Map(commitments.map((c) => [c.eventInviteId, c]));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-neutral-400">
          {event.venue ?? '—'} · {event.startsAt ? new Date(event.startsAt).toLocaleString('en-NZ') : 'TBD'}
          {event.priceLow ? ` · from $${event.priceLow}` : ''}
        </p>
      </header>

      {sp.status && (
        <div className="rounded bg-emerald-900/40 border border-emerald-700 px-4 py-2 text-sm">
          RSVP recorded: <strong>{sp.status}</strong>{sp.replay && ' (already counted)'}
        </div>
      )}

      <section className="grid grid-cols-5 gap-2 text-center">
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
        <div className="rounded border border-amber-700/40 bg-amber-900/10 p-4 text-sm">
          <div className="font-medium text-amber-300">Final call active</div>
          <div className="text-neutral-300">
            ${activeCall.pledgeAmount} per ticket · deadline {new Date(activeCall.deadlineAt).toLocaleString('en-NZ')}
          </div>
          <div className="text-neutral-400 mt-1">
            {commitments.filter((c) => c.state === 'confirmed').length} confirmed,{' '}
            {commitments.filter((c) => c.state === 'asked').length} pending,{' '}
            {commitments.filter((c) => c.state === 'dropped').length} dropped
          </div>
        </div>
      )}

      <section>
        <h2 className="font-medium mb-2">Invited</h2>
        {invitesRows.length === 0 ? (
          <p className="text-neutral-400 text-sm">Nobody invited yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded">
            {invitesRows.map(({ invite, recipient, rsvp }) => {
              const c = commitmentByInvite.get(invite.id);
              const pledgeBadge =
                rsvp?.pledgeState === 'locked' ? '🔒 locked' :
                rsvp?.pledgeState === 'pledged' ? '💵 pledged' :
                c?.state === 'asked' ? '⏳ awaiting pledge' :
                c?.state === 'dropped' ? '🚪 dropped' : null;
              return (
                <li key={invite.id} className="px-4 py-2 flex justify-between text-sm">
                  <span>{recipient?.displayName} <span className="text-neutral-500">({recipient?.email})</span></span>
                  <span className="text-neutral-400">
                    {rsvp?.status ?? 'pending'}
                    {pledgeBadge && <span className="ml-2">{pledgeBadge}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Invite people</h2>
        <InviteForm eventId={event.id} recipients={uninvited} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-neutral-800 p-3">
      <div className="text-xl font-mono">{value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}
