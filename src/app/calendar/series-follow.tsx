'use client';

import { useState, useTransition } from 'react';
import { BellIcon, BellOffIcon } from 'lucide-react';
import { subscribeToSeries, unsubscribeFromSeries } from '@/lib/series/actions';
import { cn } from '@/lib/utils';

export function SeriesFollowButton({
  seriesName,
  initialSubscribed,
}: {
  seriesName: string;
  initialSubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (subscribed) {
            await unsubscribeFromSeries({ seriesName });
          } else {
            await subscribeToSeries({ seriesName });
          }
          setSubscribed(!subscribed);
        })
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors',
        subscribed
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
          : 'border-neutral-300 bg-card text-muted-foreground hover:bg-muted',
        pending && 'opacity-50',
      )}
      aria-label={subscribed ? `Unfollow ${seriesName}` : `Follow ${seriesName}`}
    >
      {subscribed ? <BellIcon className="size-3" aria-hidden="true" /> : <BellOffIcon className="size-3" aria-hidden="true" />}
      {subscribed ? 'Following' : 'Follow series'}
    </button>
  );
}
