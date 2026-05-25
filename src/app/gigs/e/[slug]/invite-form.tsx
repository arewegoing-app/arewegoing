'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendInvites } from '@/app/gigs/lib/events/actions';
import { addRecipient } from '@/app/gigs/lib/events/actions';
import type { Recipient } from '@/app/gigs/lib/db/schema';

export function InviteForm({ eventId, recipients }: { eventId: string; recipients: Recipient[] }) {
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
