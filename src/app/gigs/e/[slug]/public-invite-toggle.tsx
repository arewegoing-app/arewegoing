'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, CopyIcon, Link2Icon, Link2OffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { enablePublicInvite, disablePublicInvite } from '../../lib/events/public-invite';

export function PublicInviteToggle({
  eventId,
  eventSlug,
  initialToken,
  appUrl,
}: {
  eventId: string;
  eventSlug: string;
  initialToken: string | null;
  appUrl: string;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const shareUrl = token ? `${appUrl}/gigs/e/${eventSlug}/join?t=${token}` : null;

  const toggle = () =>
    startTransition(async () => {
      if (token) {
        await disablePublicInvite({ eventId });
        setToken(null);
      } else {
        const r = await enablePublicInvite({ eventId });
        if (r.ok) setToken(r.token);
      }
      router.refresh();
    });

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Shareable invite link</CardTitle>
        <Button type="button" size="sm" variant={token ? 'outline' : 'default'} disabled={pending} onClick={toggle}>
          {token ? (
            <>
              <Link2OffIcon aria-hidden="true" /> Disable
            </>
          ) : (
            <>
              <Link2Icon aria-hidden="true" /> Enable
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {token && shareUrl ? (
          <>
            <p className="text-sm text-muted-foreground">
              Anyone with this link can join — they enter their name + email once and get their own
              RSVP page. Paste it into WhatsApp, IG DMs, or wherever your crew lives.
            </p>
            <div className="flex flex-wrap gap-2">
              <code className="flex-1 truncate rounded border bg-muted px-2 py-1.5 text-xs">{shareUrl}</code>
              <Button type="button" size="sm" variant="outline" onClick={copy} aria-label={copied ? 'Copied' : 'Copy link'}>
                {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Off by default. Turn it on if you want to share one link in a group chat instead of
            inviting friends one-by-one via email.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
