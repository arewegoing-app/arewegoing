'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckIcon,
  EyeIcon,
  HandIcon,
  TicketIcon,
  TicketCheckIcon,
  TicketsIcon,
  XIcon,
} from 'lucide-react';
import { setBuyerReaction } from '@/lib/discovery/reactions';

const PRIMARY = [
  { kind: 'interested', icon: EyeIcon, label: 'Interested', num: '01' },
  { kind: 'down', icon: CheckIcon, label: "I'm down", num: '02' },
  { kind: 'pledge_1', icon: TicketIcon, label: "I'll buy 1", num: '03' },
  { kind: 'pledge_2', icon: TicketIcon, label: "I'll buy 2", num: '04' },
  { kind: 'have_ticket', icon: TicketCheckIcon, label: 'Got mine', num: '05' },
  { kind: 'extras', icon: TicketsIcon, label: 'Got extras', num: '06' },
  { kind: 'need_ticket', icon: HandIcon, label: 'Need one', num: '07' },
] as const;

const SECONDARY = [
  { kind: 'cant', icon: XIcon, label: "Can't", num: '08' },
] as const;

export function CalendarReactions({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const fire = (kind: (typeof PRIMARY)[number]['kind'] | 'cant') =>
    startTransition(async () => {
      await setBuyerReaction({ eventId, kind });
      router.refresh();
    });

  return (
    <div
      role="group"
      aria-label="React to event"
      className="grid grid-cols-2 gap-px sm:grid-cols-4"
      style={{ background: 'var(--ed-line)' }}
    >
      {PRIMARY.map(({ kind, icon: Icon, label, num }) => (
        <button
          key={kind}
          type="button"
          disabled={pending}
          aria-label={label}
          className="ed-chip flex-col gap-1 px-2 py-2 sm:flex-row sm:gap-2"
          style={{
            border: 'none',
            background: 'var(--ed-bg)',
            color: 'var(--ed-fg)',
            minHeight: '56px',
            minWidth: 0,
            fontSize: '0.6875rem',
            letterSpacing: '0.03em',
            textAlign: 'center',
            justifyContent: 'center',
          }}
          onClick={() => fire(kind)}
        >
          <span className="hidden tabular-nums opacity-40 lg:inline">{num}</span>
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span className="leading-tight">{label}</span>
        </button>
      ))}
      {SECONDARY.map(({ kind, icon: Icon, label, num }) => (
        <button
          key={kind}
          type="button"
          disabled={pending}
          aria-label={label}
          className="ed-chip flex-col gap-1 px-2 py-2 sm:flex-row sm:gap-2"
          style={{
            border: 'none',
            background: 'var(--ed-bg)',
            color: 'var(--ed-fg-soft)',
            minHeight: '56px',
            minWidth: 0,
            fontSize: '0.6875rem',
            letterSpacing: '0.03em',
            textAlign: 'center',
            justifyContent: 'center',
          }}
          onClick={() => fire(kind)}
        >
          <span className="hidden tabular-nums opacity-40 lg:inline">{num}</span>
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span className="leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}
