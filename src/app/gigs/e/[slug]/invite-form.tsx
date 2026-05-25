'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendInvites } from '@/app/gigs/lib/events/actions';
import { addRecipient } from '@/app/gigs/lib/events/actions';
import type { Recipient } from '@/app/gigs/lib/db/schema';
import type { ReliabilityStats } from '@/app/gigs/lib/memory/stats';

/** Serialisable snapshot of ReliabilityStats passed from the server page. */
export type ReliabilityStatsMap = Record<string, ReliabilityStats>;

function reliabilityDot(s: ReliabilityStats): { dot: string; title: string } {
  const avgLabel = s.avgDaysToPay !== null ? `avg ${s.avgDaysToPay.toFixed(1)} days to pay` : 'no pay history';
  const title = `${s.paid} paid, ${s.bails} bailed, ${avgLabel}`;
  if (s.bails > 0) return { dot: '🔴', title };
  if (s.unpaid > 0 || (s.avgDaysToPay !== null && s.avgDaysToPay > 7)) return { dot: '🟡', title };
  return { dot: '🟢', title };
}

export function InviteForm({
  eventId,
  recipients,
  reliabilityStats,
}: {
  eventId: string;
  recipients: Recipient[];
  reliabilityStats?: ReliabilityStatsMap;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      {recipients.length > 0 ? (
        <ul className="space-y-1">
          {recipients.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              <span>{r.displayName} <span className="text-neutral-500">({r.email})</span></span>
              {reliabilityStats?.[r.id] && (() => {
                const { dot, title } = reliabilityDot(reliabilityStats[r.id]);
                return (
                  <span
                    aria-label={title}
                    title={title}
                    className="cursor-default select-none"
                  >
                    {dot}
                  </span>
                );
              })()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-400 text-sm">No recipients in your address book. Add one below.</p>
      )}

      <button
        type="button"
        disabled={selected.size === 0 || pending}
        onClick={() => startTransition(async () => {
          await sendInvites({ eventId, recipientIds: [...selected] });
          setSelected(new Set());
          router.refresh();
        })}
        className="rounded bg-emerald-600 px-4 py-2 disabled:opacity-50"
      >
        {pending ? 'Sending…' : `Send invites (${selected.size})`}
      </button>

      <form action={async (fd: FormData) => { await addRecipient(fd); router.refresh(); }} className="border-t border-neutral-800 pt-4 space-y-2">
        <div className="text-sm text-neutral-400">Add a new recipient</div>
        <div className="flex gap-2">
          <input name="displayName" placeholder="Name" required className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="email@example.com" required className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm" />
          <button type="submit" className="rounded bg-neutral-800 px-3 text-sm">Add</button>
        </div>
      </form>
    </div>
  );
}
