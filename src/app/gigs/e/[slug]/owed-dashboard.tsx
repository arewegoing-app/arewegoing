'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellRingIcon, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { markPaid } from '../../lib/purchases/actions';

type OwedRow = {
  owedId: string;
  recipientName: string;
  recipientEmail: string;
  amountCents: number;
  paid: boolean;
  daysOutstanding: number;
  lastRemindedAt: Date | null;
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
                  {r.recipientName}
                  <div className="text-xs text-muted-foreground">{r.recipientEmail}</div>
                </TableCell>
                <TableCell>{fmtCents(r.amountCents)}</TableCell>
                <TableCell className="hidden sm:table-cell">{r.daysOutstanding}d</TableCell>
                <TableCell className="hidden sm:table-cell">{fmtDate(r.lastRemindedAt)}</TableCell>
                <TableCell className="text-right">
                  <PaidToggle owedId={r.owedId} paid={r.paid} />
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
