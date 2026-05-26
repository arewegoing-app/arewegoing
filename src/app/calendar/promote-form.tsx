'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MegaphoneIcon } from 'lucide-react';
import { promoteToRally } from '@/lib/discovery/promote';
import { Button } from '@/components/ui/button';

export function PromoteToRallyForm({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await promoteToRally({ eventId });
          if (r.ok) router.push(`/gigs/e/${r.slug}`);
        })
      }
      className="w-full sm:w-auto"
    >
      <MegaphoneIcon aria-hidden="true" /> {pending ? 'Claiming…' : 'Ready to rally — claim this gig'}
    </Button>
  );
}
