'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startFinalCall } from '@/lib/rsvp/pledge';

export function FinalCallForm({ eventId, defaultPrice }: { eventId: string; defaultPrice?: number }) {
  const [amount, setAmount] = useState<string>(defaultPrice ? String(defaultPrice) : '');
  const [hours, setHours] = useState<string>('6');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="rounded border border-amber-700/40 bg-amber-900/10 p-4 space-y-2">
      <div className="text-sm font-medium text-amber-300">Start final call</div>
      <p className="text-sm text-neutral-400">
        Asks every 'going' recipient to pledge a hard commitment. After the deadline, anyone who didn't confirm drops to 'maybe'.
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Pledge $"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="w-24 rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || !amount}
          onClick={() => startTransition(async () => {
            try {
              const res = await startFinalCall({ eventId, pledgeAmount: Number(amount), deadlineHours: Number(hours) });
              setMsg(`Sent to ${res.asked} pledger${res.asked === 1 ? '' : 's'}.`);
              router.refresh();
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Failed');
            }
          })}
          className="rounded bg-amber-600 px-3 py-2 text-sm disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Send final call'}
        </button>
      </div>
      {msg && <div className="text-sm text-neutral-300">{msg}</div>}
    </div>
  );
}
