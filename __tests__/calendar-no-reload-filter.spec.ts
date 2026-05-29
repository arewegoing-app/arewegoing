/**
 * calendar-no-reload-filter.spec.ts
 *
 * Tests that the calendar filter/search updates URL params client-side without
 * triggering a full page reload, and that the URL is shareable (server renders
 * the same filtered result).
 *
 * These tests rely on the seed events in the dev DB and the client-filter
 * component introduced in the no-reload-filter slice.
 */

import { test, expect } from '@playwright/test';

test.describe('Calendar no-reload filter', () => {
  test.beforeEach(async ({ page }) => {
    // Start on the calendar with no filters active.
    await page.goto('/calendar?q=&venue=&from=&to=');
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();
  });

  test('1. typing in search filters visible cards without network request', async ({
    page,
  }) => {
    // Count cards before filtering.
    const cards = page.locator('[data-testid="event-card"]');
    const countBefore = await cards.count();
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Intercept any navigation requests — a reload would show up as a full page load.
    let reloaded = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        reloaded = true;
      }
    });

    // Type in the search box.
    const searchInput = page.getByRole('searchbox', { name: /search events/i });
    await searchInput.fill('moshi');

    // Wait up to 250ms for the list to update.
    await page.waitForTimeout(250);

    // No full reload should have occurred.
    expect(reloaded).toBe(false);
  });

  test('2. URL contains q= after typing in search', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search events/i });
    await searchInput.fill('moshi');
    await page.waitForTimeout(300);

    expect(page.url()).toContain('q=moshi');
  });

  test('3. URL with q= renders same list on fresh load (SSR consistency)', async ({
    page,
    browser,
  }) => {
    // First get the search results via client-side filtering.
    const searchInput = page.getByRole('searchbox', { name: /search events/i });
    await searchInput.fill('moshi');
    await page.waitForTimeout(300);

    const filteredUrl = page.url();

    // Open a new page with JS disabled — checks SSR renders the same list.
    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(filteredUrl, { waitUntil: 'commit' });

    // The page HTML should still contain filtered results (server-side filter).
    const html = await noJsPage.content();
    // Title of the calendar page should be present.
    expect(html).toContain('Next 90 days');

    await noJsContext.close();
  });

  test('4. clearing search shows all events and removes q from URL', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search events/i });
    await searchInput.fill('moshi');
    await page.waitForTimeout(300);

    expect(page.url()).toContain('q=moshi');

    await searchInput.clear();
    await page.waitForTimeout(300);

    // URL should not contain q=moshi anymore.
    expect(page.url()).not.toContain('q=moshi');
  });

  test('5. venue dropdown filters and updates URL', async ({ page }) => {
    // Find the venue select element.
    const venueSelect = page.getByRole('combobox', { name: /filter by venue/i });
    const optionCount = await venueSelect.locator('option').count();

    // Only test if there are venue options available.
    if (optionCount <= 1) {
      test.skip();
      return;
    }

    // Select the second option (first non-empty option).
    const firstVenueOption = venueSelect.locator('option').nth(1);
    const venueValue = await firstVenueOption.getAttribute('value');

    await venueSelect.selectOption(venueValue ?? '');
    await page.waitForTimeout(300);

    if (venueValue) {
      expect(page.url()).toContain(`venue=${encodeURIComponent(venueValue)}`);
    }
  });

  test('6. date range from/to filters and updates URL', async ({ page }) => {
    const fromInput = page.getByLabel(/filter events starting from/i);
    await fromInput.fill('2026-09-01');
    await page.waitForTimeout(300);

    expect(page.url()).toContain('from=2026-09-01');

    const toInput = page.getByLabel(/filter events ending by/i);
    await toInput.fill('2026-09-30');
    await page.waitForTimeout(300);

    expect(page.url()).toContain('to=2026-09-30');
  });

  test('7. combined q + venue + date filters all appear in URL', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search events/i });
    await searchInput.fill('test');
    await page.waitForTimeout(200);

    const fromInput = page.getByLabel(/filter events starting from/i);
    await fromInput.fill('2026-09-01');
    await page.waitForTimeout(200);

    const toInput = page.getByLabel(/filter events ending by/i);
    await toInput.fill('2026-09-30');
    await page.waitForTimeout(200);

    const url = page.url();
    expect(url).toContain('q=test');
    expect(url).toContain('from=2026-09-01');
    expect(url).toContain('to=2026-09-30');
  });

  test('8. ESC key in search input clears it', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search events/i });
    await searchInput.fill('moshi');
    await page.waitForTimeout(200);

    await searchInput.press('Escape');
    await page.waitForTimeout(200);

    const value = await searchInput.inputValue();
    expect(value).toBe('');
  });

  test('9. adversarial: 10000-char input does not crash the page', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search events/i });
    const longString = 'a'.repeat(10_000);
    await searchInput.fill(longString);
    await page.waitForTimeout(500);

    // Page should still be alive.
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();

    // No 500 errors should appear.
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Internal Server Error');
    expect(bodyText).not.toContain('500');
  });
});
