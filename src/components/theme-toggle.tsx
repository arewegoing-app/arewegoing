'use client';

import { useCallback, useSyncExternalStore } from 'react';

type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'gigs_theme';
const CYCLE: ThemeChoice[] = ['light', 'dark', 'system'];

const LABELS: Record<ThemeChoice, string> = {
  light: '☀ Light',
  dark: '☾ Dark',
  system: '⌁ System',
};

const ARIA_LABELS: Record<ThemeChoice, string> = {
  light: 'Current theme: light. Click to switch to dark.',
  dark: 'Current theme: dark. Click to switch to system preference.',
  system: 'Current theme: system preference. Click to switch to light.',
};

// ---------------------------------------------------------------------------
// External store helpers
// ---------------------------------------------------------------------------

/** Read the stored theme choice from localStorage safely. */
function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  return 'system';
}

/** Write the theme choice to localStorage safely. */
function writeStored(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Ignore write errors in restricted contexts.
  }
}

/** Apply the chosen theme to the html element. */
function applyTheme(choice: ThemeChoice): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const html = document.documentElement;
  const isDark = choice === 'dark' || (choice === 'system' && prefersDark);
  html.classList.remove('light', 'dark');
  html.classList.add(isDark ? 'dark' : 'light');
}

// ---------------------------------------------------------------------------
// useSyncExternalStore wiring
// Subscribes to: localStorage changes + OS prefers-color-scheme changes.
// ---------------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(cb: Listener): () => void {
  listeners.add(cb);

  // OS preference changes (e.g. user switches macOS dark mode).
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const mqHandler = () => {
    listeners.forEach((l) => l());
  };
  mq.addEventListener('change', mqHandler);

  // storage events from other tabs.
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listeners.forEach((l) => l());
  };
  window.addEventListener('storage', storageHandler);

  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', mqHandler);
    window.removeEventListener('storage', storageHandler);
  };
}

function getSnapshot(): ThemeChoice {
  return readStored();
}

// SSR snapshot — no localStorage available; default to 'system'.
function getServerSnapshot(): ThemeChoice {
  return 'system';
}

/**
 * ThemeToggle — cycles through light / dark / system themes.
 *
 * Persists the choice in `localStorage` under `gigs_theme`.
 * Writes `html.dark` or `html.light` classes consumed by globals.css.
 * Uses `useSyncExternalStore` to avoid calling setState inside effects.
 * Renders as an `ed-chip`-styled button.
 *
 * @returns A button that toggles the editorial surface theme.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleClick = useCallback(() => {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    writeStored(next);
    applyTheme(next);
    // Notify all subscribers (including this component) to re-render.
    listeners.forEach((l) => l());
  }, [theme]);

  return (
    <button
      type="button"
      className="ed-chip"
      style={{ minHeight: 36 }}
      aria-label={ARIA_LABELS[theme]}
      onClick={handleClick}
    >
      {LABELS[theme]}
    </button>
  );
}
