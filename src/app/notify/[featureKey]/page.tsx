import Link from 'next/link';
import { NotifyMeButton } from '@/components/notify-me-button';
import { describeFeature } from '@/lib/feature_interest/registry';

export const dynamic = 'force-dynamic';

export default async function NotifyConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ featureKey: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { featureKey } = await params;
  const sp = await searchParams;
  const { label, tagline } = describeFeature(featureKey);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="pt-2 pb-6">
        <div className="u-mono opacity-50">[!] / Logged</div>
        <h1
          className="u-display mt-2"
          style={{ fontSize: 'clamp(2.5rem, 9vw, 5rem)' }}
        >
          We&apos;ll let{' '}
          <em className="not-italic u-accent-bg">you know</em>
          <br />
          when this ships.
        </h1>
        <p className="mt-4 max-w-prose leading-snug">
          <strong>{label}</strong>
          {tagline ? <> — {tagline}</> : null} Your tap was recorded; we&apos;ll only email if you
          gave us an address.
        </p>
      </div>

      <div className="ed-card p-4 sm:p-5">
        <div className="u-mono opacity-50">[A] / Also want general updates?</div>
        <p className="u-mono mt-2 leading-relaxed opacity-70">
          Optional: drop your email so we can also ping you when something else new ships.
        </p>
        <div className="mt-3">
          <NotifyMeButton featureKey="general.new_features" label="Yes, ping me" />
        </div>
      </div>

      <p className="u-mono mt-6 leading-relaxed opacity-60">
        ↳ Back to{' '}
        <Link
          href={sp.from ?? '/calendar'}
          className="underline hover:text-[color:var(--ed-accent-2)]"
        >
          {sp.from ?? 'the calendar'}
        </Link>
        .
      </p>
    </div>
  );
}
