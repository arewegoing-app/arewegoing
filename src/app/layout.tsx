import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/auth';
import { ensureMigrated } from '@/lib/db/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'are we going?',
  description: 'Group ticket coordination for live music',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#33ff33',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureMigrated();
  const session = await auth();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <header className="border-b">
            <nav
              aria-label="Primary"
              className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
            >
              <Link href="/" className="font-mono text-base font-semibold sm:text-lg">
                are we going?
              </Link>
              <div className="flex items-center gap-3 text-sm">
                <Link href="/mine" className="text-muted-foreground hover:text-foreground">
                  Your gigs
                </Link>
                {session?.user && (
                  <Link href="/owed" className="text-muted-foreground hover:text-foreground">
                    Owed
                  </Link>
                )}
                {session?.user ? (
                  <>
                    <span
                      className="hidden text-muted-foreground sm:inline"
                      aria-label="Signed in as"
                    >
                      {session.user.email}
                    </span>
                    <form
                      action={async () => {
                        'use server';
                        await signOut({ redirectTo: '/' });
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        Sign out
                      </Button>
                    </form>
                  </>
                ) : (
                  <Link href="/signin" className={cn(buttonVariants({ size: 'sm' }))}>
                    Sign in
                  </Link>
                )}
              </div>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
