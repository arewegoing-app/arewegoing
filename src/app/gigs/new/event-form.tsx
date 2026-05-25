'use client';

import { useState, useTransition } from 'react';
import { LinkIcon, SparklesIcon } from 'lucide-react';
import { createEvent } from '../lib/events/actions';
import { fetchEventMetadata } from '../lib/ingest/action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Defaults = {
  title?: string;
  venue?: string;
  city?: string;
  startsAt?: string;
  priceLow?: number;
  ticketUrl?: string;
};

export function EventForm() {
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="size-4" aria-hidden="true" /> Paste a ticket URL to autofill
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="url"
              inputMode="url"
              placeholder="https://humanitix.com/event/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="Event URL"
            />
            <Button type="button" disabled={!url || pending} onClick={autofill}>
              <SparklesIcon aria-hidden="true" /> {pending ? 'Fetching…' : 'Autofill'}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <form action={createEvent} className="space-y-4" aria-label="Event details">
        <Field label="Title" name="title" required defaultValue={defaults.title} k={defaults.title} />
        <Field label="Venue" name="venue" defaultValue={defaults.venue} k={defaults.venue} />
        <Field label="City" name="city" defaultValue={defaults.city ?? 'Wellington'} k={defaults.city} />
        <Field
          label="Starts at"
          name="startsAt"
          type="datetime-local"
          defaultValue={defaults.startsAt}
          k={defaults.startsAt}
        />
        <Field label="Ticket URL" name="ticketUrl" type="url" defaultValue={defaults.ticketUrl} k={defaults.ticketUrl} />
        <Field
          label="Price (NZD)"
          name="priceLow"
          type="number"
          inputMode="numeric"
          defaultValue={defaults.priceLow != null ? String(defaults.priceLow) : undefined}
          k={defaults.priceLow}
        />
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Create event
        </Button>
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
}: {
  label: string;
  name: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'url';
  required?: boolean;
  defaultValue?: string;
  k?: string | number;
}) {
  const id = `field-${name}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        defaultValue={defaultValue}
        key={`k-${k ?? ''}`}
      />
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
