import { redirect } from 'next/navigation';
import { auth, signIn } from '../lib/auth/auth';

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect('/gigs');
  const devEnabled = process.env.NODE_ENV !== 'production' || process.env.GIGS_TEST_AUTH === '1';
  const googleEnabled = !!process.env.AUTH_GOOGLE_ID;
  return (
    <div className="max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {googleEnabled && (
        <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/gigs' }); }}>
          <button type="submit" className="w-full rounded bg-white text-black py-2 font-medium">Sign in with Google</button>
        </form>
      )}
      {devEnabled && (
        <form
          action={async (formData: FormData) => {
            'use server';
            const email = String(formData.get('email') ?? '');
            await signIn('dev', { email, redirectTo: '/gigs' });
          }}
          className="space-y-2"
        >
          <label className="text-sm text-neutral-400">Dev login (email only)</label>
          <input name="email" type="email" required placeholder="you@example.com" className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2" />
          <button type="submit" className="w-full rounded bg-emerald-600 py-2 font-medium">Continue</button>
        </form>
      )}
    </div>
  );
}
