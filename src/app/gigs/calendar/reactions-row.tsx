'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setBuyerReaction } from '../lib/discovery/reactions';

const KINDS = [
  { kind: 'interested', icon: '👀', label: 'Interested' },
  { kind: 'down', icon: '✅', label: 'Down' },
  { kind: 'pledge_1', icon: '🎫', label: 'Pledge 1' },
  { kind: 'pledge_2', icon: '🎫🎫', label: 'Pledge 2' },
  { kind: 'cant', icon: '❌', label: "Can't" },
] as const;

export function CalendarReactions({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-1">
      {KINDS.map(({ kind, icon, label }) => (
        <button
          key={kind}
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            await setBuyerReaction({ eventId, kind });
            router.refresh();
          })}
          className="rounded border border-neutral-800 hover:border-neutral-600 px-2 py-1 text-xs disabled:opacity-50"
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
}
