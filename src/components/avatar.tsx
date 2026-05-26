import { cn } from '@/lib/utils';

// A handful of accessible color pairs (background + readable text). Pick one
// deterministically from the name so the same person gets the same color
// across pages.
const PALETTE = [
  'bg-rose-200 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200',
  'bg-orange-200 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
  'bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-lime-200 text-lime-900 dark:bg-lime-900/40 dark:text-lime-200',
  'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  'bg-teal-200 text-teal-900 dark:bg-teal-900/40 dark:text-teal-200',
  'bg-sky-200 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
  'bg-indigo-200 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200',
  'bg-violet-200 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200',
  'bg-pink-200 text-pink-900 dark:bg-pink-900/40 dark:text-pink-200',
] as const;

const SIZE = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export type AvatarSize = keyof typeof SIZE;

export function Avatar({
  name,
  size = 'md',
  className,
  title,
}: {
  name: string;
  size?: AvatarSize;
  className?: string;
  title?: string;
}) {
  const initials = getInitials(name);
  const color = pickColor(name);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZE[size],
        color,
        className,
      )}
      aria-label={title ?? name}
      title={title ?? name}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 5,
  size = 'sm',
  className,
}: {
  names: string[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const shown = names.slice(0, max);
  const extra = Math.max(0, names.length - max);
  if (shown.length === 0) return null;
  return (
    <div className={cn('flex -space-x-1.5', className)} aria-label={`${names.length} people`}>
      {shown.map((n, i) => (
        <Avatar
          key={`${n}-${i}`}
          name={n}
          size={size}
          className="border-2 border-background"
          title={n}
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted font-medium text-muted-foreground',
            SIZE[size],
          )}
          aria-label={`+${extra} more`}
          title={`+${extra} more`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
