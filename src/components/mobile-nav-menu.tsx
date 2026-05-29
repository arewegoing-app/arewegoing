'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';

type Props = {
  signedIn: boolean;
  userEmail?: string | null;
  /** Server-rendered sign-out form, slotted in when signedIn. */
  signOutSlot?: React.ReactNode;
};

export function MobileNavMenu({ signedIn, userEmail, signOutSlot }: Props) {
  const [open, setOpen] = useState(false);

  // Auto-close on link click. Sheet won't know the route changed,
  // and leaving it open after navigation feels broken.
  const closeOnNav = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-controls="mobile-nav-panel"
        className="u-mono inline-flex items-center gap-2 px-3 py-2"
        style={{
          background: 'transparent',
          color: 'var(--ed-fg)',
          border: '1px solid var(--ed-line)',
          minHeight: '44px',
          minWidth: '44px',
        }}
      >
        <span aria-hidden className="inline-flex flex-col gap-[3px]">
          <span
            style={{
              width: '18px',
              height: '2px',
              background: 'currentColor',
            }}
          />
          <span
            style={{
              width: '18px',
              height: '2px',
              background: 'currentColor',
            }}
          />
          <span
            style={{
              width: '18px',
              height: '2px',
              background: 'currentColor',
            }}
          />
        </span>
        Menu
      </SheetTrigger>

      <SheetContent
        id="mobile-nav-panel"
        side="right"
        className="flex flex-col gap-0 p-0"
        style={{
          background: 'var(--ed-bg)',
          color: 'var(--ed-fg)',
          borderLeftColor: 'var(--ed-line)',
        }}
      >
        <SheetHeader className="border-b" style={{ borderColor: 'var(--ed-line)' }}>
          <SheetTitle className="u-display text-xl">Menu</SheetTitle>
          <SheetDescription className="u-mono" style={{ color: 'var(--ed-fg-soft)' }}>
            {signedIn && userEmail ? userEmail : 'Anonymous visitor'}
          </SheetDescription>
        </SheetHeader>

        <nav
          aria-label="Mobile primary"
          className="flex flex-1 flex-col gap-1 p-4"
        >
          <MobileNavLink href="/" onNavigate={closeOnNav}>
            Home
          </MobileNavLink>
          <MobileNavLink href="/calendar" onNavigate={closeOnNav}>
            Calendar
          </MobileNavLink>
          <MobileNavLink href="/mine" onNavigate={closeOnNav}>
            Your gigs
          </MobileNavLink>
          {signedIn && (
            <MobileNavLink href="/owed" onNavigate={closeOnNav}>
              Owed
            </MobileNavLink>
          )}
        </nav>

        <div
          className="flex flex-col gap-3 border-t p-4"
          style={{ borderColor: 'var(--ed-line)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="u-mono" style={{ color: 'var(--ed-fg-soft)' }}>
              Theme
            </span>
            <ThemeToggle />
          </div>

          {signedIn ? (
            <SheetClose render={<span />}>{signOutSlot}</SheetClose>
          ) : (
            <SheetClose
              render={
                <Link
                  href="/signin"
                  className="ed-chip u-mono inline-flex items-center justify-center"
                  style={{ minHeight: '48px' }}
                >
                  Sign in <span aria-hidden>↗</span>
                </Link>
              }
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileNavLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="u-mono flex items-center gap-2 px-3 py-3 hover:underline"
      style={{
        color: 'var(--ed-fg)',
        minHeight: '48px',
      }}
    >
      <span aria-hidden>↳</span>
      {children}
    </Link>
  );
}
