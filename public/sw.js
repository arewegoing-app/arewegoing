/**
 * arewegoing service worker
 *
 * Strategy:
 *   - Navigation requests (HTML)   → network-first, falls back to html cache
 *   - Hashed static assets         → cache-first (/_next/static/**)
 *   - Everything else              → network-only (API routes, etc.)
 *
 * Pure helper functions below are the canonical source inlined from
 * src/lib/pwa/sw-helpers.ts — any change there MUST be mirrored here.
 */

// ── helpers (source of truth: src/lib/pwa/sw-helpers.ts) ─────────────────

const CACHE_VERSION = 'v1';

/** @param {'static'|'html'} bucket */
function cacheNameFor(bucket) {
  return `arewegoing-${bucket}-${CACHE_VERSION}`;
}

const STATIC_CACHE = cacheNameFor('static');
const HTML_CACHE = cacheNameFor('html');
const ALL_CACHES = [STATIC_CACHE, HTML_CACHE];

/** True when the URL is a hashed Next.js static asset safe for cache-first. */
function shouldCacheRequest(reqUrl) {
  try {
    const { pathname } = new URL(reqUrl);
    return pathname.startsWith('/_next/static/');
  } catch {
    return false;
  }
}

/** True when the request is a browser HTML navigation. */
function isNavigationRequest(req) {
  if (req.method !== 'GET') return false;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

// ── lifecycle ─────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Pre-cache the two core navigation shells.
      const cache = await caches.open(HTML_CACHE);
      await cache.addAll(['/', '/calendar']);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete any cache from a previous version.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k)),
      );
      // Take control of all open clients immediately.
      await self.clients.claim();
    })(),
  );
});

// ── fetch ─────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET and cross-origin requests.
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (shouldCacheRequest(request.url)) {
    // Cache-first for hashed static assets.
    event.respondWith(cacheFirstStatic(request));
  } else if (isNavigationRequest(request)) {
    // Network-first for HTML navigations so users never get stale calendar data.
    event.respondWith(networkFirstHtml(request));
  }
  // All other requests (API routes, Next.js data endpoints, etc.) fall through
  // to the browser's default network behaviour.
});

// ── strategies ────────────────────────────────────────────────────────────

/**
 * Cache-first: serve from STATIC_CACHE when available, otherwise
 * fetch, cache the response, and return it.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirstStatic(request) {
  const cached = await caches.match(request, { cacheName: STATIC_CACHE });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Network-first: always try the network so the user sees fresh HTML.
 * On network failure, serve from HTML_CACHE (offline fallback).
 * On network success, update the cache in the background.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirstHtml(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(HTML_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: HTML_CACHE });
    if (cached) return cached;
    // Last resort: serve root from cache if exact URL isn't cached yet.
    const root = await caches.match('/', { cacheName: HTML_CACHE });
    if (root) return root;
    return new Response('Offline — please try again later.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
