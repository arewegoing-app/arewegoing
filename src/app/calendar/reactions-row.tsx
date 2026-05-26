'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, EyeIcon, TicketIcon, TicketCheckIcon, XIcon } from 'lucide-react';
import { setBuyerReaction } from '@/lib/discovery/reactions';
import { Button } from '@/components/ui/button';

const KINDS = [
  { kind: 'interested', icon: EyeIcon, label: 'Interested' },
  { kind: 'down', icon: CheckIcon, label: "I'm down" },
  { kind: 'pledge_1', icon: TicketIcon, label: 'Pledge 1' },
  { kind: 'pledge_2', icon: TicketIcon, label: 'Pledge 2' },
  { kind: 'have_ticket', icon: TicketCheckIcon, label: 'Got mine' },
  { kind: 'cant', icon: XIcon, label: "Can't" },
] as const;

export function CalendarReactions({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <div role="group" aria-label="React to event" className="flex flex-wrap gap-1.5">
      {KINDS.map(({ kind, icon: Icon, label }) => (
        <Button
          key={kind}
          type="button"
          size="default"
          variant="outline"
          disabled={pending}
          aria-label={label}
          className="min-h-[36px]"
          onClick={() =>
            startTransition(async () => {
              await setBuyerReaction({ eventId, kind });
              router.refresh();
            })
          }
        >
          <Icon aria-hidden="true" /> <span>{label}</span>
        </Button>
      ))}
    </div>
  );
}
