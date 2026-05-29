'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js with the browser's service-worker API on mount.
 * Silent no-op in browsers that do not support service workers.
 * Mount once inside <body> in the root layout — not inside <main>.
 */
export function RegisterSW(): null {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      // Registration failures (e.g. HTTPS not available in dev) are non-fatal.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[pwa] service worker registration failed:', err);
      }
    });
  }, []);

  return null;
}
