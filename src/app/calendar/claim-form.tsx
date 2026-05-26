'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MegaphoneIcon } from 'lucide-react';
import { claimDiscoveredEvent } from '@/lib/events/anon-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ClaimForm({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <MegaphoneIcon aria-hidden="true" /> Rally this — claim & invite friends
      </Button>
    );
  }

  return (
    <form
      className="space-y-3"
      action={(fd: FormData) =>
        startTransition(async () => {
          setError(null);
          const result = await claimDiscoveredEvent(fd);
          if (!result.ok) {
            setError(result.reason === 'already_claimed' ? 'Someone else already claimed this gig.' : 'Could not claim');
            return;
          }
          router.push(`/e/${result.slug}`);
        })
      }
      aria-label={`Claim ${eventTitle}`}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`claim-name-${eventId}`}>Your first name</Label>
          <Input id={`claim-name-${eventId}`} name="ownerName" required placeholder="Oli" autoComplete="given-name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`claim-email-${eventId}`}>Your email</Label>
          <Input
            id={`claim-email-${eventId}`}
            name="ownerEmail"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        We&apos;ll bookmark this URL for you. No password — keep the link to come back.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
          {pending ? 'Claiming…' : 'Rally this gig'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
