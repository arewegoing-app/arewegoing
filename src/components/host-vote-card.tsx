'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { voteForHost } from '@/lib/host_votes';

type Row = { candidateLabel: string; count: number; mine: boolean };

const COPY = {
  predrinks: {
    sectionNum: '[06]',
    sectionLabel: 'Pre-drinks',
    title: 'Where are we pre-ing?',
    placeholder: 'Suggest a spot…',
  },
  afters: {
    sectionNum: '[07]',
    sectionLabel: 'Afters',
    title: 'Where are we ending up?',
    placeholder: 'Suggest the after-spot…',
  },
} as const;

export function HostVoteCard({
  eventId,
  kind,
  initialRows,
}: {
  eventId: string;
  kind: 'predrinks' | 'afters';
  initialRows: Row[];
}) {
  const [newLabel, setNewLabel] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const copy = COPY[kind];

  const cast = (candidateLabel: string) =>
    startTransition(async () => {
      const label = candidateLabel.trim();
      if (!label) return;
      await voteForHost({ eventId, kind, candidateLabel: label });
      setNewLabel('');
      router.refresh();
    });

  const leader = initialRows[0];

  return (
    <section className="ed-card p-4 sm:p-5">
      <div className="u-mono opacity-50">
        {copy.sectionNum} / {copy.sectionLabel}
      </div>
      <h3
        className="u-display mt-1"
        style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}
      >
        {copy.title}
      </h3>

      {leader && (
        <p className="u-mono mt-2 opacity-70">
          ↳ Leading:{' '}
          <strong className="u-accent-bg" style={{ color: 'var(--ed-fg)' }}>
            {leader.candidateLabel}
          </strong>{' '}
          ({leader.count})
        </p>
      )}

      {initialRows.length === 0 ? (
        <p className="u-mono mt-3 opacity-60">↳ No suggestions yet — pitch one below.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {initialRows.map((r) => (
            <li key={r.candidateLabel}>
              <button
                type="button"
                onClick={() => cast(r.candidateLabel)}
                disabled={pending}
                aria-pressed={r.mine}
                className="ed-chip"
                data-active={r.mine}
              >
                <span>{r.candidateLabel}</span>
                <span
                  className="ml-1 tabular-nums opacity-70"
                  aria-label={`${r.count} vote${r.count === 1 ? '' : 's'}`}
                >
                  · {String(r.count).padStart(2, '0')}
                </span>
                {r.mine && (
                  <span className="ml-1" aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          cast(newLabel);
        }}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        aria-label={`Suggest a ${copy.sectionLabel.toLowerCase()} spot`}
      >
        <label htmlFor={`host-${kind}-input`} className="u-mono sr-only">
          {copy.placeholder}
        </label>
        <input
          id={`host-${kind}-input`}
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          maxLength={120}
          placeholder={copy.placeholder}
          className="flex-1 border bg-[color:var(--ed-bg)] px-3 py-3"
          style={{
            borderColor: 'var(--ed-line)',
            borderRadius: 0,
            fontFamily: 'var(--font-jbmono)',
            fontSize: '0.875rem',
            minHeight: '44px',
          }}
        />
        <button
          type="submit"
          disabled={pending || !newLabel.trim()}
          className="ed-chip"
          style={{ minHeight: '44px' }}
        >
          {pending ? '...' : '+ Add + vote ↗'}
        </button>
      </form>
    </section>
  );
}
