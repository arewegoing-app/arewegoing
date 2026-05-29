import Link from 'next/link';
import { WaitlistForm } from '@/components/waitlist-form';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 py-6 sm:py-10">
      <section className="flex flex-col gap-6">
        <h1
          className="text-4xl leading-tight sm:text-6xl"
          style={{
            fontFamily: 'var(--font-archivo-black), ui-sans-serif, system-ui, sans-serif',
            lineHeight: 1.05,
          }}
        >
          Are we going<span style={{ color: 'var(--ed-accent)' }}>?</span>
        </h1>
        <p
          className="max-w-2xl text-lg sm:text-xl"
          style={{ color: 'var(--ed-fg-soft)' }}
        >
          A coordination layer for live music. Public calendar at the top,
          shareable group calendars underneath. Friends decide together. Money
          only moves when the crew commits.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/calendar"
            className="u-mono inline-flex items-center px-4 py-3"
            style={{
              background: 'var(--ed-fg)',
              color: 'var(--ed-bg)',
              border: '1px solid var(--ed-line)',
              minHeight: '48px',
            }}
          >
            See what&apos;s on <span aria-hidden>&nbsp;→</span>
          </Link>
          <a
            href="#waitlist"
            className="u-mono inline-flex items-center px-4 py-3 hover:underline"
            style={{
              color: 'var(--ed-fg)',
              border: '1px solid var(--ed-line)',
              minHeight: '48px',
            }}
          >
            Get notified <span aria-hidden>&nbsp;↓</span>
          </a>
        </div>
      </section>

      <section
        className="flex flex-col gap-6 border-y py-8"
        style={{ borderColor: 'var(--ed-line)' }}
      >
        <h2 className="u-display text-2xl">How it works</h2>
        <ol className="flex flex-col gap-5">
          <li className="flex flex-col gap-2">
            <strong className="u-mono">1. Browse the public calendar.</strong>
            <span style={{ color: 'var(--ed-fg-soft)' }}>
              Wellington gigs, festivals, and tours pulled from the platforms
              you already use. Filter, react, follow series.
            </span>
          </li>
          <li className="flex flex-col gap-2">
            <strong className="u-mono">2. Share an event with friends.</strong>
            <span style={{ color: 'var(--ed-fg-soft)' }}>
              Sharing creates a group calendar at{' '}
              <code style={{ background: 'var(--ed-accent)', color: 'var(--ed-on-accent)', padding: '0 0.2em' }}>
                /group/&hellip;
              </code>
              . The pinned event sits on top. The public list sits below.
            </span>
          </li>
          <li className="flex flex-col gap-2">
            <strong className="u-mono">
              3. The crew picks what they&apos;re going to together.
            </strong>
            <span style={{ color: 'var(--ed-fg-soft)' }}>
              Tap an event in the group calendar to add it to the pinned list.
              Coordinate without spinning up another group chat.
            </span>
          </li>
          <li className="flex flex-col gap-2">
            <strong className="u-mono">4. No signup until you want one.</strong>
            <span style={{ color: 'var(--ed-fg-soft)' }}>
              Pick an emoji and a nickname. Claim the identity later with a
              magic link if you want to carry it between groups.
            </span>
          </li>
        </ol>
      </section>

      <section
        id="waitlist"
        className="flex flex-col gap-4 scroll-mt-24"
      >
        <h2 className="u-display text-2xl">Get notified</h2>
        <p
          className="max-w-xl"
          style={{ color: 'var(--ed-fg-soft)' }}
        >
          arewegoing is still being built. Drop your email and we&apos;ll let
          you know when there&apos;s something worth opening.
        </p>
        <div className="max-w-xl">
          <WaitlistForm />
        </div>
        <p className="u-mono" style={{ color: 'var(--ed-fg-soft)' }}>
          ▪ One email, no marketing list. Unsubscribe link in every message.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="u-display text-2xl">Built differently</h2>
        <ul className="flex flex-col gap-3">
          <li
            className="u-mono"
            style={{ color: 'var(--ed-fg-soft)' }}
          >
            <span aria-hidden>▸ </span>Worker cooperative. Surplus goes back
            to the scene, not a cap table.
          </li>
          <li
            className="u-mono"
            style={{ color: 'var(--ed-fg-soft)' }}
          >
            <span aria-hidden>▸ </span>Promoter rebate on group buys.
          </li>
          <li
            className="u-mono"
            style={{ color: 'var(--ed-fg-soft)' }}
          >
            <span aria-hidden>▸ </span>Artist tip jar at the point of pledge.
          </li>
        </ul>
      </section>
    </div>
  );
}
