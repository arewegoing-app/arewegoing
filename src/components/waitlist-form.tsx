'use client';

import { useState, useTransition } from 'react';
import { recordFeatureInterest } from '@/lib/feature_interest';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    startTransition(async () => {
      const result = await recordFeatureInterest({
        featureKey: 'general.waitlist',
        email,
        notifyOptIn: true,
      });
      setStatus(result.ok ? 'done' : 'error');
    });
  };

  if (status === 'done') {
    return (
      <div
        className="u-mono inline-flex items-center gap-2 px-4 py-3"
        style={{
          background: 'var(--ed-accent)',
          color: 'var(--ed-fg)',
          border: '1px solid var(--ed-line)',
          minHeight: '48px',
        }}
        aria-live="polite"
      >
        ✓ We&apos;ll let you know.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch"
    >
      <label htmlFor="waitlist-email" className="sr-only">
        Email
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={pending}
        className="u-mono flex-1 px-3 py-3"
        style={{
          background: 'var(--ed-bg)',
          color: 'var(--ed-fg)',
          border: '1px solid var(--ed-line)',
          minHeight: '48px',
        }}
      />
      <button
        type="submit"
        disabled={pending || !email}
        className="u-mono px-4 py-3"
        style={{
          background: 'var(--ed-fg)',
          color: 'var(--ed-bg)',
          border: '1px solid var(--ed-line)',
          minHeight: '48px',
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending || !email ? 0.6 : 1,
        }}
      >
        {pending ? 'Sending…' : 'Notify me'}
      </button>
      {status === 'error' && (
        <span
          role="alert"
          className="u-mono"
          style={{ color: 'var(--ed-accent-2)' }}
        >
          Something went wrong. Try again?
        </span>
      )}
    </form>
  );
}
