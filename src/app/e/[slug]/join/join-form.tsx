'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinViaPublicInvite } from '@/lib/events/public-invite';

export function JoinForm({
  eventId,
  publicToken,
  eventTitle,
}: {
  eventId: string;
  publicToken: string;
  eventTitle: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      action={(fd: FormData) =>
        startTransition(async () => {
          setError(null);
          const res = await joinViaPublicInvite({
            eventId,
            publicToken,
            joinerName: String(fd.get('joinerName') ?? ''),
            joinerEmail: String(fd.get('joinerEmail') ?? ''),
          });
          if (!res.ok) {
            setError(res.reason === 'invalid_token' ? 'Link is expired or revoked.' : 'Could not join.');
            return;
          }
          router.push(res.respondUrl.replace(/^https?:\/\/[^/]+/, ''));
        })
      }
      aria-label={`Join ${eventTitle}`}
    >
      <div className="space-y-1.5">
        <Label htmlFor="joiner-name">Your first name</Label>
        <Input id="joiner-name" name="joinerName" required placeholder="Sam" autoComplete="given-name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="joiner-email">Your email</Label>
        <Input
          id="joiner-email"
          name="joinerEmail"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        <ArrowRightIcon aria-hidden="true" /> {pending ? 'Joining…' : 'Take me to my RSVP'}
      </Button>
    </form>
  );
}
