import Link from 'next/link';
import { auth, signOut } from './lib/auth/auth';
import { ensureMigrated } from './lib/db/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function GigsLayout({ children }: { children: React.ReactNode }) {
  await ensureMigrated();
  const session = await auth();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <nav
          aria-label="Primary"
          className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
        >
          <Link href="/gigs" className="font-mono text-base font-semibold sm:text-lg">
            gigs
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/gigs/mine" className="text-muted-foreground hover:text-foreground">
              Your gigs
            </Link>
            {session?.user && (
              <Link href="/gigs/owed" className="text-muted-foreground hover:text-foreground">
                Owed
              </Link>
            )}
            {session?.user ? (
              <>
                <span className="hidden text-muted-foreground sm:inline" aria-label="Signed in as">
                  {session.user.email}
                </span>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/gigs' });
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <Link href="/gigs/signin" className={cn(buttonVariants({ size: 'sm' }))}>
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
