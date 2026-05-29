'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordFeatureInterest } from '@/lib/feature_interest';

type Props = {
  /** Stable key — see src/lib/feature_interest/registry.ts. */
  featureKey: string;
  /** Visible label on the chip. Defaults to "Notify me". */
  label?: string;
  /** When true, navigate to /notify/[featureKey] on success instead of inline confirmation. */
  redirectOnSuccess?: boolean;
  /** Optional extra metadata (free text, max 4000 chars). */
  meta?: string;
};

export function NotifyMeButton({
  featureKey,
  label = 'Notify me',
  redirectOnSuccess = false,
  meta,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (email?: string) =>
    startTransition(async () => {
      const result = await recordFeatureInterest({
        featureKey,
        notifyOptIn: true,
        email: email || undefined,
        meta,
      });
      if (result.ok) {
        if (redirectOnSuccess) {
          router.push(`/notify/${encodeURIComponent(featureKey)}`);
        } else {
          setDone(true);
        }
      }
    });

  if (done) {
    return (
      <span
        className="u-mono inline-flex items-center gap-2 px-3 py-2"
        style={{
          background: 'var(--ed-accent)',
          color: 'var(--ed-on-accent)',
          border: '1px solid var(--ed-line)',
          minHeight: '44px',
        }}
        aria-live="polite"
      >
        ✓ We&apos;ll let you know.
      </span>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className="ed-chip"
        onClick={() => setExpanded(true)}
        disabled={pending}
      >
        ↗ {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get('email') ?? '').trim();
        submit(email);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor={`notify-${featureKey}`} className="u-mono sr-only">
        Email (optional)
      </label>
      <input
        id={`notify-${featureKey}`}
        name="email"
        type="email"
        placeholder="email (optional) ↗"
        autoComplete="email"
        className="border bg-[color:var(--ed-bg)] px-3 py-2"
        style={{
          borderColor: 'var(--ed-line)',
          borderRadius: 0,
          fontFamily: 'var(--font-jbmono)',
          fontSize: '0.875rem',
          minHeight: '44px',
          minWidth: '14rem',
        }}
      />
      <button type="submit" disabled={pending} className="ed-chip">
        {pending ? '...' : 'Notify me ↗'}
      </button>
      <button
        type="button"
        onClick={() => {
          if (pending) return;
          // Submit with no email — still records intent.
          submit('');
        }}
        disabled={pending}
        className="u-mono px-2 py-1 hover:text-[color:var(--ed-accent-2)]"
        style={{ color: 'var(--ed-fg-soft)', minHeight: '36px' }}
      >
        ↳ skip email
      </button>
    </form>
  );
}
