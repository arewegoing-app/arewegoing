'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, MailQuestionIcon, TagIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { setPromoStatus } from '../../lib/promo/actions';

type Status = 'not_asked' | 'asked' | 'got_code' | 'declined';

export function PromoPanel({
  eventId,
  initialStatus,
  initialCode,
}: {
  eventId: string;
  initialStatus: Status;
  initialCode: string | null;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [code, setCode] = useState<string>(initialCode ?? '');
  const [showCodeInput, setShowCodeInput] = useState(initialStatus === 'got_code');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const apply = (next: Status, opts: { code?: string } = {}) => {
    startTransition(async () => {
      await setPromoStatus({ eventId, status: next, code: opts.code });
      setStatus(next);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Promo code</CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'not_asked' && (
          <>
            <p className="text-sm text-muted-foreground">
              Promoters sometimes give group discounts. Worth a DM if you&apos;re bringing 4+ friends.
            </p>
            <Button type="button" disabled={pending} onClick={() => apply('asked')}>
              <MailQuestionIcon aria-hidden="true" /> Mark as asked
            </Button>
          </>
        )}

        {status === 'asked' && !showCodeInput && (
          <>
            <p className="text-sm text-muted-foreground">Outreach sent. Waiting on a response.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => setShowCodeInput(true)}>
                <TagIcon aria-hidden="true" /> Got a code
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => apply('declined')}>
                <XIcon aria-hidden="true" /> Declined
              </Button>
            </div>
          </>
        )}

        {showCodeInput && status !== 'got_code' && (
          <div className="space-y-2">
            <Label htmlFor="promo-code">Code</Label>
            <div className="flex gap-2">
              <Input
                id="promo-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="FRIENDS20"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <Button
                type="button"
                disabled={pending || !code}
                onClick={() => {
                  apply('got_code', { code });
                  setShowCodeInput(false);
                }}
              >
                <CheckIcon aria-hidden="true" /> Save
              </Button>
            </div>
          </div>
        )}

        {status === 'got_code' && (
          <div className="space-y-2">
            <p className="text-sm">
              Use code{' '}
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                {initialCode ?? code}
              </span>{' '}
              at checkout.
            </p>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setShowCodeInput(true); setStatus('asked'); }}>
              Change code
            </Button>
          </div>
        )}

        {status === 'declined' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Promoter said no this time.</p>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => apply('not_asked')}>
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    not_asked: { label: 'Not asked', variant: 'outline' },
    asked: { label: 'Asked', variant: 'secondary' },
    got_code: { label: 'Got code', variant: 'default' },
    declined: { label: 'Declined', variant: 'outline' },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
