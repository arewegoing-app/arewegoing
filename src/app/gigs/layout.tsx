import Link from 'next/link';
import { auth, signOut } from './lib/auth/auth';
import { ensureMigrated } from './lib/db/client';

export const dynamic = 'force-dynamic';

export default async function GigsLayout({ children }: { children: React.ReactNode }) {
  await ensureMigrated();
  const session = await auth();
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <nav className="border-b border-neutral-800 px-6 py-3 flex items-center justify-between">
        <Link href="/gigs" className="font-mono text-lg">gigs</Link>
        <div className="flex items-center gap-4 text-sm">
          {session?.user ? (
            <>
              <span className="text-neutral-400">{session.user.email}</span>
              <form action={async () => { 'use server'; await signOut({ redirectTo: '/gigs' }); }}>
                <button type="submit" className="text-neutral-400 hover:text-neutral-100">sign out</button>
              </form>
            </>
          ) : (
            <Link href="/gigs/signin" className="text-emerald-400">sign in</Link>
          )}
        </div>
      </nav>
      <div className="px-6 py-8 max-w-4xl mx-auto">{children}</div>
    </main>
  );
}
