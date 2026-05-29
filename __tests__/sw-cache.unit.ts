/**
 * Unit tests for SW helper pure functions.
 * Import from src/lib/pwa/sw-helpers.ts — no browser globals needed.
 */
import assert from 'node:assert/strict';
import { shouldCacheRequest, isNavigationRequest, cacheNameFor } from '../src/lib/pwa/sw-helpers';

// ──────────────────────────────────────────────────────────
// shouldCacheRequest
// ──────────────────────────────────────────────────────────

// Static hashed Next.js assets → cache-first
assert.equal(shouldCacheRequest('http://localhost:3000/_next/static/chunks/main-abc123.js'), true, 'hashed JS chunk should be cached');
assert.equal(shouldCacheRequest('http://localhost:3000/_next/static/css/app-xyz789.css'), true, 'hashed CSS should be cached');
assert.equal(shouldCacheRequest('http://localhost:3000/_next/static/media/font.woff2'), true, 'static media should be cached');

// HTML navigations → network-first, NOT cache-first
assert.equal(shouldCacheRequest('http://localhost:3000/'), false, 'root HTML should not be cache-first');
assert.equal(shouldCacheRequest('http://localhost:3000/calendar'), false, 'calendar HTML should not be cache-first');
assert.equal(shouldCacheRequest('http://localhost:3000/calendar?view=list'), false, 'calendar with query should not be cache-first');

// API routes → never cache-first
assert.equal(shouldCacheRequest('http://localhost:3000/api/events'), false, 'API routes should not be cache-first');
assert.equal(shouldCacheRequest('http://localhost:3000/api/rsvp?token=abc'), false, 'API with query should not be cache-first');

// Adversarial inputs
assert.equal(shouldCacheRequest('http://localhost:3000/_next/static/chunks/main.js?v=1&bust=true'), true, 'static with cache-bust params still cache-first');
assert.equal(shouldCacheRequest('http://localhost:3000/_next/static/chunks/main.js#section'), true, 'static with fragment still cache-first');
assert.equal(shouldCacheRequest('http://localhost:3000/_next/data/abc123/calendar.json'), false, 'Next.js data routes are not static assets');

// ──────────────────────────────────────────────────────────
// isNavigationRequest
// ──────────────────────────────────────────────────────────

// Valid navigation
assert.equal(
  isNavigationRequest({ method: 'GET', headers: new Headers({ accept: 'text/html,application/xhtml+xml' }) }),
  true,
  'GET with text/html accept is navigation',
);

// Non-GET methods
assert.equal(
  isNavigationRequest({ method: 'POST', headers: new Headers({ accept: 'text/html' }) }),
  false,
  'POST is not a navigation request',
);
assert.equal(
  isNavigationRequest({ method: 'PUT', headers: new Headers({ accept: 'text/html' }) }),
  false,
  'PUT is not a navigation request',
);
assert.equal(
  isNavigationRequest({ method: 'DELETE', headers: new Headers({ accept: 'text/html' }) }),
  false,
  'DELETE is not a navigation request',
);
assert.equal(
  isNavigationRequest({ method: 'HEAD', headers: new Headers({ accept: 'text/html' }) }),
  false,
  'HEAD is not a navigation request',
);

// Missing / wrong accept header
assert.equal(
  isNavigationRequest({ method: 'GET', headers: new Headers({ accept: 'application/json' }) }),
  false,
  'GET for JSON is not a navigation request',
);
assert.equal(
  isNavigationRequest({ method: 'GET', headers: new Headers({}) }),
  false,
  'GET with no accept header is not a navigation request',
);
assert.equal(
  isNavigationRequest({ method: 'GET', headers: new Headers({ accept: 'image/webp,image/png' }) }),
  false,
  'GET for image is not a navigation request',
);

// ──────────────────────────────────────────────────────────
// cacheNameFor
// ──────────────────────────────────────────────────────────

assert.equal(cacheNameFor('static'), 'arewegoing-static-v1', 'static cache name is versioned');
assert.equal(cacheNameFor('html'), 'arewegoing-html-v1', 'html cache name is versioned');

// Verify they are distinct
assert.notEqual(cacheNameFor('static'), cacheNameFor('html'), 'static and html caches must differ');

console.log('sw-cache.unit.ts: all assertions passed');
