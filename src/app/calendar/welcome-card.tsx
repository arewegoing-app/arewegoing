'use client';

import { useState } from 'react';
import { XIcon, CheckCircle2Icon, MegaphoneIcon, TicketIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const COOKIE_NAME = 'gigs_welcome_dismissed';

export function WelcomeCard({ dismissed }: { dismissed: boolean }) {
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;

  const dismiss = () => {
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=31536000; samesite=lax`;
    setHidden(true);
  };

  return (
    <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
            What&apos;s this?
          </h2>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={dismiss}
            aria-label="Dismiss welcome card"
            className="text-emerald-900 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm text-emerald-900/90 dark:text-emerald-100/80">
          A shared calendar for Wellington gigs. No signin. Tap a reaction on any event:
        </p>
        <ul className="space-y-2 text-sm leading-snug text-emerald-900/90 dark:text-emerald-100/80">
          <li className="flex items-start gap-2">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>I&apos;m down</strong> signals you&apos;re keen
            </span>
          </li>
          <li className="flex items-start gap-2">
            <TicketIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Pledge 1 or 2 tickets</strong> if you&apos;d commit to buying
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MegaphoneIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Once 3+ are down, anyone can <strong>Rally this</strong>, claim the gig, invite friends by email, run the buy.
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
