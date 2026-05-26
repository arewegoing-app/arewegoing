'use client';

import { useState, useTransition } from 'react';
import { createEvent } from '@/lib/events/actions';
import { fetchEventMetadata } from '@/lib/ingest/action';

type Defaults = {
  title?: string;
  venue?: string;
  city?: string;
  startsAt?: string;
  priceLow?: number;
  ticketUrl?: string;
};

export function EventForm({ signedIn }: { signedIn: boolean }) {
  const [url, setUrl] = useState('');
  const [defaults, setDefaults] = useState<Defaults>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const autofill = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetchEventMetadata({ url });
      if (!res.ok) {
        setError(res.message ?? `Couldn't autofill (${res.reason}). Fill the form below manually.`);
        return;
      }
      setDefaults({
        title: res.metadata.title,
        venue: res.metadata.venue,
        city: res.metadata.city,
        startsAt: res.metadata.startsAt ? toLocalInput(res.metadata.startsAt) : undefined,
        priceLow: res.metadata.priceLow,
        ticketUrl: res.metadata.ticketUrl,
      });
    });
  };

  return (
    <div className="space-y-6">
      <section className="ed-card p-4 sm:p-5">
        <div className="u-mono opacity-50">[01] / Autofill from URL</div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            placeholder="https://humanitix.com/event/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Event URL"
            className="flex-1 border bg-[color:var(--ed-bg)] px-3 py-3"
            style={{
              borderColor: 'var(--ed-line)',
              borderRadius: 0,
              fontFamily: 'var(--font-jbmono)',
              fontSize: '0.875rem',
              minHeight: '48px',
            }}
          />
          <button
            type="button"
            disabled={!url || pending}
            onClick={autofill}
            className="ed-chip"
            style={{ minHeight: '48px' }}
          >
            ↗ {pending ? 'Fetching…' : 'Autofill'}
          </button>
        </div>
        {error && (
          <p role="alert" className="u-mono mt-2" style={{ color: 'var(--ed-accent-2)' }}>
            ↳ {error}
          </p>
        )}
      </section>

      <form action={createEvent} className="space-y-4" aria-label="Event details">
        <Field label="Title" name="title" required defaultValue={defaults.title} k={defaults.title} num="02" />
        <Field label="Venue" name="venue" defaultValue={defaults.venue} k={defaults.venue} num="03" />
        <Field label="City" name="city" defaultValue={defaults.city ?? 'Wellington'} k={defaults.city} num="04" />
        <Field
          label="Starts at"
          name="startsAt"
          type="datetime-local"
          defaultValue={defaults.startsAt}
          k={defaults.startsAt}
          num="05"
        />
        <Field
          label="Ticket URL"
          name="ticketUrl"
          type="url"
          defaultValue={defaults.ticketUrl}
          k={defaults.ticketUrl}
          num="06"
        />
        <Field
          label="Price (NZD)"
          name="priceLow"
          type="number"
          inputMode="numeric"
          defaultValue={defaults.priceLow != null ? String(defaults.priceLow) : undefined}
          k={defaults.priceLow}
          num="07"
        />

        {!signedIn && (
          <section className="ed-card p-4 sm:p-5">
            <div className="u-mono opacity-50">[08] / Anon owner (optional)</div>
            <p className="u-mono mt-2 leading-relaxed opacity-70">
              ↳ Your event will be linked to this browser via cookie. Add a name + email so we can
              reach out if needed.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Your name"
                name="anonOwnerName"
                num=""
                k="anon-name"
                noNum
              />
              <Field
                label="Email"
                name="anonOwnerEmail"
                type="email"
                num=""
                k="anon-email"
                noNum
              />
            </div>
          </section>
        )}

        <button
          type="submit"
          className="ed-chip w-full justify-center sm:w-auto"
          style={{ minHeight: '52px', fontSize: '0.875rem' }}
        >
          Create event ↗
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  inputMode,
  required,
  defaultValue,
  k,
  num,
  noNum,
}: {
  label: string;
  name: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'url';
  required?: boolean;
  defaultValue?: string;
  k?: string | number;
  num?: string;
  noNum?: boolean;
}) {
  const id = `field-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="u-mono flex items-center gap-2 opacity-70">
        {!noNum && num && <span className="opacity-60">[{num}]</span>}
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" style={{ color: 'var(--ed-accent-2)' }}>
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        defaultValue={defaultValue}
        key={`k-${k ?? ''}`}
        className="w-full border bg-[color:var(--ed-bg)] px-3 py-3"
        style={{
          borderColor: 'var(--ed-line)',
          borderRadius: 0,
          fontFamily: 'var(--font-jbmono)',
          fontSize: '0.875rem',
          minHeight: '48px',
        }}
      />
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
