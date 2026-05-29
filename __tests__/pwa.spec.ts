/**
 * PWA shell E2E tests.
 * Verifies manifest, service-worker availability, and caching behaviour.
 */
import { test, expect } from '@playwright/test';

test.describe('PWA manifest', () => {
  test('manifest.webmanifest is reachable with correct content-type', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('manifest+json');
  });

  test('manifest JSON contains required keys', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    const json = await res.json();

    expect(json.name).toBeTruthy();
    expect(json.short_name).toBeTruthy();
    expect(json.start_url).toBe('/');
    expect(json.display).toBe('standalone');
    expect(json.theme_color).toBeTruthy();
    expect(json.background_color).toBeTruthy();
    expect(Array.isArray(json.icons)).toBe(true);

    const icon192 = json.icons.find(
      (i: { sizes?: string; type?: string }) =>
        i.sizes === '192x192' && i.type === 'image/png',
    );
    const icon512 = json.icons.find(
      (i: { sizes?: string; type?: string }) =>
        i.sizes === '512x512' && i.type === 'image/png',
    );
    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();
  });
});

test.describe('PWA HTML link', () => {
  test('<link rel="manifest"> points to /manifest.webmanifest', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
  });
});

test.describe('service worker', () => {
  test('sw.js is reachable with correct content-type', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct.includes('javascript')).toBe(true);
  });

  test('navigator.serviceWorker.controller is non-null after two loads', async ({ page }) => {
    // First load — SW installs
    await page.goto('/');
    await page.waitForTimeout(500);
    // Second load — SW activates and takes control
    await page.goto('/');
    await page.waitForTimeout(500);

    const controlled = await page.evaluate(
      () => navigator.serviceWorker?.controller !== null,
    );
    expect(controlled).toBe(true);
  });

  test('network-first: second HTML response reflects updated content', async ({
    page,
    context,
  }) => {
    // First load - prime the SW cache
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Inject a route handler that adds a custom marker header
    const marker = `pwa-test-marker-${Date.now()}`;
    await context.route('**/calendar', async (route) => {
      const res = await route.fetch();
      const body = await res.text();
      // Embed marker in the body so we can detect it
      const patched = body.replace(
        '<body',
        `<!-- ${marker} --><body`,
      );
      await route.fulfill({
        status: res.status(),
        headers: { ...res.headers(), 'x-pwa-marker': marker },
        body: patched,
      });
    });

    await page.goto('/calendar');
    const content = await page.content();
    // Network-first means we see the live (marker-injected) response, not a cached old one
    expect(content).toContain(marker);
  });

  test('offline fallback: /calendar renders from cache', async ({ page, context }) => {
    // Prime the cache
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.goto('/calendar');
    await page.waitForTimeout(500);
    // Load again so SW is controller
    await page.goto('/calendar');
    await page.waitForTimeout(500);

    // Go offline
    await context.setOffline(true);

    // Should still render something meaningful from cache
    await page.goto('/calendar');
    const body = await page.textContent('body');
    // Expect the page shell or "Calendar" heading to be present
    expect(body).toMatch(/Calendar|are we going/i);

    // Restore
    await context.setOffline(false);
  });
});
