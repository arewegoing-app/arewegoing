'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlusIcon, CheckIcon, MessageCircleIcon, RefreshCwIcon, ShareIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { refreshEventMetadata } from '../../lib/events/refresh';

// CalendarPlusIcon imported above with other lucide icons.

export function ShareButtons({
  eventTitle,
  eventVenue,
  eventDate,
  eventId,
  shareUrl,
  icsUrl,
  showRefresh,
}: {
  eventTitle: string;
  eventVenue: string | null;
  eventDate: string | null;
  eventId: string;
  shareUrl: string;
  icsUrl: string;
  showRefresh: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const router = useRouter();

  const whatsappText = [
    `${eventTitle}${eventDate ? ` — ${eventDate}` : ''}${eventVenue ? ` @ ${eventVenue}` : ''}`,
    "Who's in?",
    shareUrl,
  ].join('\n');
  const waHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const refresh = () =>
    startTransition(async () => {
      setRefreshMsg(null);
      const r = await refreshEventMetadata({ eventId });
      if (r.ok) {
        setRefreshMsg(r.updated ? 'Refreshed from source.' : 'Source returned no new data.');
        router.refresh();
      } else {
        setRefreshMsg(`Could not refresh (${r.reason}).`);
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <a href={waHref} target="_blank" rel="noreferrer" aria-label="Share to WhatsApp" className={cn(buttonVariants())}>
        <MessageCircleIcon aria-hidden="true" /> Share to WhatsApp
      </a>
      <Button type="button" variant="outline" onClick={copyLink} aria-label={copied ? 'Link copied' : 'Copy share link'}>
        {copied ? <CheckIcon aria-hidden="true" /> : <ShareIcon aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <a
        href={icsUrl}
        download
        aria-label="Add to calendar"
        className={cn(buttonVariants({ variant: 'outline' }))}
      >
        <CalendarPlusIcon aria-hidden="true" /> Add to calendar
      </a>
      {showRefresh && (
        <Button type="button" variant="ghost" disabled={pending} onClick={refresh} aria-label="Refresh metadata from source">
          <RefreshCwIcon aria-hidden="true" className={pending ? 'animate-spin' : undefined} />
          {pending ? 'Refreshing…' : 'Refresh from source'}
        </Button>
      )}
      {refreshMsg && <p className="w-full text-xs text-muted-foreground" aria-live="polite">{refreshMsg}</p>}
    </div>
  );
}
