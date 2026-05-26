'use client';

import { useState } from 'react';
import { XIcon } from 'lucide-react';

const COOKIE_NAME = 'gigs_welcome_dismissed';

export function WelcomeCard({ dismissed }: { dismissed: boolean }) {
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;

  const dismiss = () => {
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=31536000; samesite=lax`;
    setHidden(true);
  };

  return (
    <aside className="ed-card" aria-label="How it works" style={{ background: 'var(--ed-bg)' }}>
      <div className="flex items-center justify-between border-b border-[color:var(--ed-line)] px-4 py-2 sm:px-5">
        <span className="u-mono opacity-60">↳ How it works</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss welcome card"
          className="u-mono inline-flex items-center gap-1 px-2 py-1 hover:text-[color:var(--ed-accent-2)]"
          style={{ minHeight: '36px', minWidth: '36px', justifyContent: 'center' }}
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div
        className="grid grid-cols-1 gap-px sm:grid-cols-3"
        style={{ background: 'var(--ed-line)' }}
      >
        <div className="p-4 sm:p-5" style={{ background: 'var(--ed-bg)' }}>
          <div className="u-mono opacity-50">[A] / Step 01</div>
          <div className="u-display mt-2 text-2xl">React</div>
          <p className="u-mono mt-2 leading-relaxed opacity-70">
            Tap <em className="u-accent-bg not-italic">I&apos;m down</em> on any event. No signin.
          </p>
        </div>
        <div className="p-4 sm:p-5" style={{ background: 'var(--ed-bg)' }}>
          <div className="u-mono opacity-50">[B] / Step 02</div>
          <div className="u-display mt-2 text-2xl">Pledge</div>
          <p className="u-mono mt-2 leading-relaxed opacity-70">
            Say <em className="u-accent-bg not-italic">I&apos;ll buy 1</em> or{' '}
            <em className="u-accent-bg not-italic">2</em> if you&apos;d front tickets.
          </p>
        </div>
        <div className="p-4 sm:p-5" style={{ background: 'var(--ed-bg)' }}>
          <div className="u-mono opacity-50">[C] / Step 03</div>
          <div className="u-display mt-2 text-2xl">Rally</div>
          <p className="u-mono mt-2 leading-relaxed opacity-70">
            Once 3+ are down, anyone can claim, invite, and run the group buy.
          </p>
        </div>
      </div>
    </aside>
  );
}
