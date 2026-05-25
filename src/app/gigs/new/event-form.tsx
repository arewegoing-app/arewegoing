'use client';

import { useState, useTransition } from 'react';
import { createEvent } from '../lib/events/actions';
import { fetchEventMetadata } from '../lib/ingest/action';

export function EventForm() {
  const [url, setUrl] = useState('');
  const [defaults, setDefaults] = useState<{
    title?: string;
    venue?: string;
    city?: string;
    startsAt?: string;
    priceLow?: number;
    ticketUrl?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const autofill = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetchEventMetadata({ url });
      if (!res.ok) {
        setError(res.message ?? `Couldn't autofill (${res.reason}). Fill the form manually.`);
        return;
      }
      const startsAtLocal = res.metadata.startsAt ? toLocalInput(res.metadata.startsAt) : undefined;
      setDefaults({
        title: res.metadata.title,
        venue: res.metadata.venue,
        city: res.metadata.city,
        startsAt: startsAtLocal,
        priceLow: res.metadata.priceLow,
        ticketUrl: res.metadata.ticketUrl,
      });
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded border border-neutral-800 p-4 space-y-2">
        <div className="text-sm text-neutral-400">Paste an event URL to autofill</div>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://humanitix.com/event/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!url || pending}
            onClick={autofill}
            className="rounded bg-neutral-800 px-4 py-2 text-sm disabled:opacity-50"
          >
            {pending ? 'Fetching…' : 'Autofill'}
          </button>
        </div>
        {error && <div className="text-sm text-amber-400">{error}</div>}
      </section>

      <form action={createEvent} className="space-y-4">
        <Field label="Title" name="title" required defaultValue={defaults.title} key={`t-${defaults.title ?? ''}`} />
        <Field label="Venue" name="venue" defaultValue={defaults.venue} key={`v-${defaults.venue ?? ''}`} />
        <Field label="City" name="city" defaultValue={defaults.city ?? 'Wellington'} key={`c-${defaults.city ?? ''}`} />
        <Field label="Starts at" name="startsAt" type="datetime-local" defaultValue={defaults.startsAt} key={`s-${defaults.startsAt ?? ''}`} />
        <Field label="Ticket URL" name="ticketUrl" type="url" defaultValue={defaults.ticketUrl} key={`u-${defaults.ticketUrl ?? ''}`} />
        <Field label="Price (NZD)" name="priceLow" type="number" defaultValue={defaults.priceLow != null ? String(defaults.priceLow) : undefined} key={`p-${defaults.priceLow ?? ''}`} />
        <button type="submit" className="rounded bg-emerald-600 px-4 py-2">Create event</button>
      </form>
    </div>
  );
}

function Field({ label, name, type = 'text', required, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-neutral-400">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2" />
    </label>
  );
}

function toLocalInput(iso: string): string {
  // datetime-local expects YYYY-MM-DDTHH:mm (no seconds, no timezone). Convert from ISO to user local time.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
