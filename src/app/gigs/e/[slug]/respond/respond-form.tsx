'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setRsvpConditions } from '@/app/gigs/lib/rsvp/conditions';
import { setRsvpByInviteId, setHasOwnTicket } from './actions';

type Status = 'going' | 'maybe' | 'out' | 'conditional';
type ConditionKind = 'min_going' | 'price_ceiling' | 'requires_promo';
type Action = Status | 'have_ticket';

type Condition =
  | { kind: 'min_going'; value: number; satisfied: boolean }
  | { kind: 'price_ceiling'; value: number; satisfied: boolean }
  | { kind: 'requires_promo'; value: boolean; satisfied: boolean };

const STATUS_BUTTONS: Array<{ status: Action; label: string; hint?: string }> = [
  { status: 'going', label: "I'm in" },
  { status: 'have_ticket', label: 'Got mine already', hint: 'Already bought my own ticket' },
  { status: 'maybe', label: 'Maybe' },
  { status: 'out', label: "Can't this time" },
];

export function RespondForm({
  eventInviteId,
  currentStatus,
  currentConditions,
}: {
  eventInviteId: string;
  currentStatus: Status | null;
  currentConditions: Condition[];
}) {
  const [status, setStatus] = useState<Status | null>(currentStatus);
  const [conditions, setConditions] = useState<Condition[]>(currentConditions);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const hasCondition = (k: ConditionKind) => conditions.some((c) => c.kind === k);

  const toggleCondition = (k: ConditionKind) => {
    if (hasCondition(k)) {
      setConditions(conditions.filter((c) => c.kind !== k));
    } else {
      const next: Condition =
        k === 'min_going'
          ? { kind: 'min_going', value: 2, satisfied: false }
          : k === 'price_ceiling'
            ? { kind: 'price_ceiling', value: 40, satisfied: false }
            : { kind: 'requires_promo', value: true, satisfied: false };
      setConditions([...conditions, next]);
    }
  };

  const updateValue = (k: ConditionKind, value: number) => {
    setConditions(conditions.map((c) => (c.kind === k ? { ...c, value } : c)) as Condition[]);
  };

  const submit = (chosen: Action) => {
    startTransition(async () => {
      setMsg(null);
      if (chosen === 'have_ticket') {
        await setHasOwnTicket({ eventInviteId, hasOwnTicket: true });
        // Also mark them as going so the headcount reflects it.
        await setRsvpByInviteId({ eventInviteId, status: 'going' });
        setStatus('going');
        router.refresh();
        return;
      }
      if (chosen === 'conditional') {
        if (conditions.length === 0) {
          setMsg('Pick at least one condition or use a different button.');
          return;
        }
        await setRsvpConditions({
          eventInviteId,
          conditions: conditions.map((c) =>
            c.kind === 'requires_promo'
              ? { kind: 'requires_promo' as const, value: c.value }
              : c.kind === 'min_going'
                ? { kind: 'min_going' as const, value: c.value }
                : { kind: 'price_ceiling' as const, value: c.value },
          ),
        });
      } else {
        await setRsvpByInviteId({ eventInviteId, status: chosen });
        // If they picked an unconditional status, clear any old conditions too.
        if (conditions.length > 0) {
          await setRsvpConditions({ eventInviteId, conditions: [] });
          setConditions([]);
        }
      }
      setStatus(chosen);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUS_BUTTONS.map(({ status: s, label, hint }) => (
          <Button
            key={s}
            type="button"
            variant={status === s ? 'default' : 'outline'}
            disabled={pending}
            onClick={() => submit(s)}
            className="h-auto whitespace-normal py-3 text-xs sm:text-sm"
            aria-label={hint ?? label}
            title={hint}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-md border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Yes — but only if&hellip;</span>
          {status === 'conditional' && <span className="text-xs text-emerald-600 dark:text-emerald-400">saved</span>}
        </div>

        <ConditionRow
          label="At least"
          suffix="other friends are in"
          enabled={hasCondition('min_going')}
          onToggle={() => toggleCondition('min_going')}
          value={conditions.find((c) => c.kind === 'min_going')?.value as number | undefined}
          onChange={(n) => updateValue('min_going', n)}
          placeholder="2"
        />

        <ConditionRow
          label="Price stays under $"
          enabled={hasCondition('price_ceiling')}
          onToggle={() => toggleCondition('price_ceiling')}
          value={conditions.find((c) => c.kind === 'price_ceiling')?.value as number | undefined}
          onChange={(n) => updateValue('price_ceiling', n)}
          placeholder="40"
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasCondition('requires_promo')}
            onChange={() => toggleCondition('requires_promo')}
            className="size-4"
          />
          Only if we land a promo code
        </label>

        <Button
          type="button"
          disabled={pending || conditions.length === 0}
          onClick={() => submit('conditional')}
          className="w-full"
        >
          {pending ? 'Saving…' : 'Save conditional yes'}
        </Button>
      </div>

      {msg && <p className="text-sm text-amber-600 dark:text-amber-400">{msg}</p>}

      {status && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Current answer:{' '}
          <strong className="text-foreground">
            {status === 'conditional' ? 'Conditional yes' : status === 'going' ? "I'm in" : status === 'maybe' ? 'Maybe' : "Can't"}
          </strong>
          .
          {conditions.length > 0 && status === 'conditional' && (
            <span className="ml-1">
              Auto-flips to &quot;in&quot; once {conditions.map((c) => labelFor(c)).join(' and ')}.
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function ConditionRow({
  label,
  suffix,
  enabled,
  onToggle,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  suffix?: string;
  enabled: boolean;
  onToggle: () => void;
  value: number | undefined;
  onChange: (n: number) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input type="checkbox" checked={enabled} onChange={onToggle} className="size-4" aria-label={label} />
      <span>{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        className="h-8 w-20"
        value={enabled ? (value ?? '') : ''}
        disabled={!enabled}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={placeholder}
      />
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

function labelFor(c: Condition): string {
  if (c.kind === 'min_going') return `${c.value} others are in`;
  if (c.kind === 'price_ceiling') return `price stays under $${c.value}`;
  return 'we have a promo code';
}

// Suppress unused warning when Label not used in this iteration.
void Label;
