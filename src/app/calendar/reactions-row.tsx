'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, EyeIcon, TicketIcon, TicketCheckIcon, XIcon } from 'lucide-react';
import { setBuyerReaction } from '@/lib/discovery/reactions';

const KINDS = [
  { kind: 'interested', icon: EyeIcon, label: 'Interested', num: '01' },
  { kind: 'down', icon: CheckIcon, label: "I'm down", num: '02' },
  { kind: 'pledge_1', icon: TicketIcon, label: "I'll buy 1", num: '03' },
  { kind: 'pledge_2', icon: TicketIcon, label: "I'll buy 2", num: '04' },
  { kind: 'have_ticket', icon: TicketCheckIcon, label: 'Got mine', num: '05' },
  { kind: 'cant', icon: XIcon, label: "Can't", num: '06' },
] as const;

export function CalendarReactions({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <div
      role="group"
      aria-label="React to event"
      className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6"
      style={{ background: 'var(--ed-line)' }}
    >
      {KINDS.map(({ kind, icon: Icon, label, num }) => (
        <button
          key={kind}
          type="button"
          disabled={pending}
          aria-label={label}
          className="ed-chip justify-center"
          style={{
            border: 'none',
            background: 'var(--ed-bg)',
            color: 'var(--ed-fg)',
            minHeight: '48px',
          }}
          onClick={() =>
            startTransition(async () => {
              await setBuyerReaction({ eventId, kind });
              router.refresh();
            })
          }
        >
          <span className="opacity-40 tabular-nums">{num}</span>
          <Icon aria-hidden="true" className="size-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
