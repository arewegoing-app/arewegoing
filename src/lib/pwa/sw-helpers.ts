/**
 * Pure helper functions shared between the unit-test suite and public/sw.js.
 *
 * sw.js is plain JavaScript — it cannot import TypeScript directly.
 * These functions are copy-pasted inline into sw.js with a comment pointing here.
 * Any change here MUST be mirrored in public/sw.js.
 */

/** Version suffix — bump when the caching strategy changes. */
const CACHE_VERSION = 'v1';

/**
 * Returns the versioned cache-store name for a given bucket.
 *
 * @param bucket - 'static' for hashed assets, 'html' for navigations
 * @returns versioned cache name, e.g. 'arewegoing-static-v1'
 */
export function cacheNameFor(bucket: 'static' | 'html'): string {
  return `arewegoing-${bucket}-${CACHE_VERSION}`;
}

/**
 * True when the request URL points to a hashed static asset that is safe
 * to serve cache-first.  Uses path prefix only — no content-type sniffing.
 *
 * Static: /_next/static/**
 * NOT static: /_next/data/**, /api/**, HTML navigation routes
 *
 * @param reqUrl - absolute URL string
 */
export function shouldCacheRequest(reqUrl: string): boolean {
  try {
    const { pathname } = new URL(reqUrl);
    return pathname.startsWith('/_next/static/');
  } catch {
    return false;
  }
}

/**
 * True when the fetch represents a browser navigation (the browser wants HTML).
 *
 * Only GET requests with an Accept header that includes `text/html` qualify.
 * POST / PUT / DELETE / HEAD are never navigations.  XHR / fetch calls that
 * request JSON, images, or other MIME types are also excluded.
 *
 * @param req - object with `method` string and `headers` Headers instance
 */
export function isNavigationRequest(req: {
  method: string;
  headers: Headers;
}): boolean {
  if (req.method !== 'GET') return false;
  const accept = req.headers.get('accept') ?? '';
  return accept.includes('text/html');
}
