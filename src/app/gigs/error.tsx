'use client';

import { useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function GigsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch('/gigs/api/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'client_error',
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : '',
      }),
      keepalive: true,
    }).catch(() => {
      // The beacon is best-effort. Swallow errors.
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-semibold">Something broke</h1>
      <p className="mt-2 text-muted-foreground">
        Sorry, that didn&apos;t work. The team has been pinged with the details.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <a href="/gigs" className={cn(buttonVariants({ variant: 'outline' }))}>
          Back to calendar
        </a>
      </div>
    </div>
  );
}
