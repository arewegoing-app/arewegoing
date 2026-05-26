import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth/auth';

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect('/');
  const devEnabled = process.env.NODE_ENV !== 'production';
  const googleEnabled = !!process.env.AUTH_GOOGLE_ID;
  return (
    <div className="mx-auto w-full max-w-md">
      {/* Hero block */}
      <div className="pt-2 pb-6">
        <div className="u-mono opacity-50">[00] / Sign in</div>
        <h1
          className="u-display mt-2"
          style={{ fontSize: 'clamp(2.5rem, 9vw, 5rem)' }}
        >
          Only the{' '}
          <em className="not-italic u-accent-bg">organiser</em>
          <br />
          needs an account.
        </h1>
        <p className="mt-4 max-w-prose leading-snug">
          Friends you invite respond from email — no signup required. You only need an account if
          you&apos;re running the group buy.
        </p>
      </div>

      <div className="ed-card">
        {googleEnabled && (
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
            className="border-b border-[color:var(--ed-line)] p-4 sm:p-5"
          >
            <div className="u-mono opacity-50 mb-2">[01] / Google</div>
            <button
              type="submit"
              className="ed-chip w-full justify-center"
              style={{ minHeight: '52px', fontSize: '0.875rem' }}
            >
              ↳ Sign in with Google
            </button>
          </form>
        )}
        {devEnabled && (
          <form
            action={async (formData: FormData) => {
              'use server';
              const email = String(formData.get('email') ?? '');
              await signIn('dev', { email, redirectTo: '/' });
            }}
            className="p-4 sm:p-5"
            aria-label="Dev sign in"
          >
            <div className="u-mono opacity-50 mb-2">
              [{googleEnabled ? '02' : '01'}] / Email (dev)
            </div>
            <label htmlFor="signin-email" className="u-mono sr-only">
              Email
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full border border-[color:var(--ed-line)] bg-[color:var(--ed-bg)] px-3 py-3 text-base"
              style={{ borderRadius: 0, fontFamily: 'var(--font-jbmono)', minHeight: '52px' }}
            />
            <button
              type="submit"
              className="ed-chip mt-3 w-full justify-center"
              style={{ minHeight: '52px', fontSize: '0.875rem' }}
            >
              Continue ↗
            </button>
          </form>
        )}

        {!googleEnabled && !devEnabled && (
          <div className="p-6 text-center">
            <div className="u-mono opacity-60">↳ No sign-in providers configured.</div>
          </div>
        )}
      </div>

      <p className="u-mono mt-6 leading-relaxed opacity-60">
        ↳ Browsing? Head back to{' '}
        <a href="/calendar" className="underline hover:text-[color:var(--ed-accent-2)]">
          the calendar
        </a>
        . No signin needed to react.
      </p>
    </div>
  );
}
