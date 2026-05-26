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
    <div className="space-y-2">
      <div
        role="group"
        aria-label="React to event"
        className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-7"
        style={{ background: 'var(--ed-line)' }}
      >
        {PRIMARY.map(({ kind, icon: Icon, label, num }) => (
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
            onClick={() => fire(kind)}
          >
            <span className="opacity-40 tabular-nums">{num}</span>
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Secondary row — `Can't` is visually demoted. Still tap-reachable. */}
      <div className="flex justify-end">
        {SECONDARY.map(({ kind, icon: Icon, label }) => (
          <button
            key={kind}
            type="button"
            disabled={pending}
            aria-label={label}
            className="u-mono inline-flex items-center gap-1 px-3 py-2 hover:text-[color:var(--ed-accent-2)]"
            style={{ color: 'var(--ed-fg-soft)', minHeight: '36px' }}
            onClick={() => fire(kind)}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span>↳ {label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
