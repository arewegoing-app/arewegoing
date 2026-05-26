import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Archivo, Archivo_Black, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { auth, signOut } from '@/lib/auth/auth';
import { ensureMigrated } from '@/lib/db/client';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
// Editorial type system — applied via CSS to every non-homepage route.
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});
const archivoBlack = Archivo_Black({
  variable: '--font-archivo-black',
  subsets: ['latin'],
  weight: '400',
});
const jbMono = JetBrains_Mono({
  variable: '--font-jbmono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

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
      className={[
        geistSans.variable,
        geistMono.variable,
        archivo.variable,
        archivoBlack.variable,
        jbMono.variable,
        'h-full antialiased',
      ].join(' ')}
      style={{ fontFamily: 'var(--font-archivo), ui-sans-serif, system-ui, sans-serif' }}
    >
      <head>
        {/* Anti-FOUC: apply dark/light class before React hydrates so the
            editorial palette never flashes the wrong background colour.
            Reads localStorage.gigs_theme; falls back to OS preference.
            Defensive against localStorage being unavailable (private modes). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('gigs_theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(t==='dark'||(t==='system'&&d)||(!t&&d)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.add('light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col">
          <header
            className="ed-topbar border-b border-[color:var(--ed-line)]"
            style={{ background: 'var(--ed-bg)' }}
          >
            <nav
              aria-label="Primary"
              className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
            >
              <Link
                href="/"
                className="u-display text-base"
                aria-label="are we going? — home"
              >
                ARE&nbsp;WE&nbsp;GOING<span style={{ color: 'var(--ed-accent)' }}>?</span>
              </Link>
              <div className="flex items-center gap-3 text-sm">
                <Link href="/calendar" className="u-mono hover:text-[color:var(--ed-accent-2)]">
                  <span aria-hidden>↳ </span>Calendar
                </Link>
                <Link href="/mine" className="u-mono hover:text-[color:var(--ed-accent-2)]">
                  <span aria-hidden>↳ </span>Your gigs
                </Link>
                {session?.user && (
                  <Link href="/owed" className="u-mono hover:text-[color:var(--ed-accent-2)]">
                    <span aria-hidden>↳ </span>Owed
                  </Link>
                )}
                <ThemeToggle />
                {session?.user ? (
                  <>
                    <span
                      className="u-mono hidden sm:inline"
                      style={{ color: 'var(--ed-fg-soft)' }}
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
                      <Button type="submit" variant="ghost" size="sm" className="u-mono">
                        Sign out
                      </Button>
                    </form>
                  </>
                ) : (
                  <Link href="/signin" className="ed-chip">
                    Sign in <span aria-hidden>↗</span>
                  </Link>
                )}
              </div>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
