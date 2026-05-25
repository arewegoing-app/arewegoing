'use client';

import { useState, useTransition } from 'react';
import { BellIcon, BellOffIcon } from 'lucide-react';
import { subscribeToArtist, unsubscribeFromArtist } from '../lib/artists/actions';
import { cn } from '@/lib/utils';

/**
 * Small "Follow artist" pill button. Mirrors the SeriesFollowButton pattern.
 *
 * @param artistName - Display name of the artist.
 * @param songkickId - Optional Songkick artist ID for resolution on subscribe.
 * @param initialSubscribed - Server-rendered subscription state.
 */
export function ArtistFollowButton({
  artistName,
  songkickId,
  initialSubscribed,
}: {
  artistName: string;
  songkickId?: string;
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
            await unsubscribeFromArtist({ artistName, songkickId });
          } else {
            await subscribeToArtist({ artistName, songkickId });
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
      aria-label={subscribed ? `Unfollow ${artistName}` : `Follow ${artistName}`}
    >
      {subscribed ? (
        <BellIcon className="size-3" aria-hidden="true" />
      ) : (
        <BellOffIcon className="size-3" aria-hidden="true" />
      )}
      {subscribed ? 'Following' : 'Follow artist'}
    </button>
  );
}
