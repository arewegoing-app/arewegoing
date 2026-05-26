'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellRingIcon, CheckIcon, UserMinusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { markPaid } from '@/lib/purchases/actions';
import { buyerMarksDrop } from '@/lib/rsvp/buyer-bail';
import { Avatar } from '@/components/avatar';

type OwedRow = {
  owedId: string;
  inviteId: string;
  recipientName: string;
  recipientEmail: string;
  amountCents: number;
  paid: boolean;
  daysOutstanding: number;
  lastRemindedAt: Date | null;
  bailed: boolean;
};

const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : '—';

export function OwedDashboard({
  rows,
  totals,
}: {
  rows: OwedRow[];
  totals: { fronted: number; received: number; outstanding: number };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <CardTitle>Who owes what</CardTitle>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Fronted: <strong className="text-foreground">{fmtCents(totals.fronted)}</strong></span>
          <span>Received: <strong className="text-foreground">{fmtCents(totals.received)}</strong></span>
          <span>Outstanding: <strong className="text-foreground">{fmtCents(totals.outstanding)}</strong></span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Owed</TableHead>
              <TableHead className="hidden sm:table-cell">Days out</TableHead>
              <TableHead className="hidden sm:table-cell">Reminded</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.owedId}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.recipientName} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate">{r.recipientName}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.recipientEmail}</div>
                      {r.bailed && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">bailed — resale open</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{fmtCents(r.amountCents)}</TableCell>
                <TableCell className="hidden sm:table-cell">{r.daysOutstanding}d</TableCell>
                <TableCell className="hidden sm:table-cell">{fmtDate(r.lastRemindedAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {!r.paid && !r.bailed && <DropAction inviteId={r.inviteId} />}
                    <PaidToggle owedId={r.owedId} paid={r.paid} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No purchases yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DropAction({ inviteId }: { inviteId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label="Mark as dropped — open resale"
      onClick={() => {
        const ok = window.confirm("Mark this person as dropped? Their ticket will be offered to the rest of the crew. They still owe you if nobody claims it before the deadline.");
        if (!ok) return;
        startTransition(async () => {
          await buyerMarksDrop({ inviteId });
          router.refresh();
        });
      }}
    >
      <UserMinusIcon aria-hidden="true" /> Drop
    </Button>
  );
}

function PaidToggle({ owedId, paid }: { owedId: string; paid: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant={paid ? 'secondary' : 'outline'}
      disabled={pending}
      aria-label={paid ? 'Mark as unpaid' : 'Mark as paid'}
      onClick={() =>
        startTransition(async () => {
          await markPaid({ owedId, paid: !paid });
          router.refresh();
        })
      }
    >
      {paid ? (
        <>
          <CheckIcon aria-hidden="true" /> Paid
        </>
      ) : (
        <>
          <BellRingIcon aria-hidden="true" /> Mark paid
        </>
      )}
    </Button>
  );
}
