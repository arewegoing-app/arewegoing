'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TicketIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { anonClaimResale } from '@/lib/rsvp/anon-claim';

export function ClaimResaleForm({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      action={(fd: FormData) =>
        startTransition(async () => {
          setError(null);
          const res = await anonClaimResale({
            eventId,
            claimerName: String(fd.get('claimerName') ?? ''),
            claimerEmail: String(fd.get('claimerEmail') ?? ''),
          });
          if (!res.ok) {
            setError(
              res.reason === 'already_taken'
                ? 'Someone beat you to it.'
                : res.reason === 'expired'
                  ? 'This listing has expired.'
                  : 'Could not claim.',
            );
            return;
          }
          router.push(`/gigs/e/${res.eventSlug}?claimed=1`);
        })
      }
      aria-label={`Claim resale ticket for ${eventTitle}`}
    >
      <div className="space-y-1.5">
        <Label htmlFor="claimer-name">Your first name</Label>
        <Input id="claimer-name" name="claimerName" required placeholder="Sam" autoComplete="given-name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="claimer-email">Your email</Label>
        <Input
          id="claimer-email"
          name="claimerEmail"
          type="email"
          inputMode="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        <TicketIcon aria-hidden="true" /> {pending ? 'Claiming…' : 'Take this ticket'}
      </Button>
    </form>
  );
}
