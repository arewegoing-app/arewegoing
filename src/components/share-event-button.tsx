'use client';

import { useState, useTransition } from 'react';
import { shareEventAsGroup } from '@/lib/groups/share';

type Props = {
  eventId: string;
  eventTitle: string;
};

/**
 * Client component that shares an event as a group calendar URL.
 * Tries navigator.share first; falls back to clipboard copy.
 */
export function ShareEventButton({ eventId, eventTitle }: Props) {
  const [pending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  function handleShare() {
    startTransition(async () => {
      const result = await shareEventAsGroup(eventId);
      if (!result.ok) {
        showToast('Could not share event.');
        return;
      }
      const { url } = result;
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ url, title: `Are we going to ${eventTitle}?` });
        } else {
          await navigator.clipboard.writeText(url);
          showToast('Copied!');
        }
      } catch {
        // User cancelled native share or clipboard failed — try clipboard as fallback.
        try {
          await navigator.clipboard.writeText(url);
          showToast('Copied!');
        } catch {
          showToast('Share link: ' + url);
        }
      }
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={handleShare}
        disabled={pending}
        aria-label={`Share ${eventTitle}`}
        className="u-mono inline-flex items-center gap-1 hover:text-[color:var(--ed-accent-2)]"
        style={{ color: 'var(--ed-fg-soft)', opacity: pending ? 0.6 : 1 }}
      >
        ↗ Share
      </button>
      {toastMsg && (
        <span
          role="status"
          aria-live="polite"
          className="u-mono absolute -top-8 left-0 whitespace-nowrap rounded px-2 py-1 text-sm"
          style={{ background: 'var(--ed-fg)', color: 'var(--ed-bg)' }}
        >
          {toastMsg}
        </span>
      )}
    </span>
  );
}
