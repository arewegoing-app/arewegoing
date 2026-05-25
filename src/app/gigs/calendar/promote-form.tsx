'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { promoteToRally } from '../lib/discovery/promote';

export function PromoteToRallyForm({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await promoteToRally({ eventId });
        if (r.ok) router.push(`/gigs/e/${r.slug}`);
      })}
      className="rounded bg-emerald-600 px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {pending ? 'Promoting…' : 'Ready to rally — claim this event'}
    </button>
  );
}
