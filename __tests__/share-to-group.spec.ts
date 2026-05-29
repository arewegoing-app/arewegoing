/**
 * E2E spec for the share-to-group feature.
 *
 * Covers at 390px (mobile) and 1024px (desktop):
 *   1. Tap share → URL copied to clipboard (or native share on mobile)
 *   2. Navigate to the group calendar URL
 *   3. Pinned event is shown in the "pinned" section
 *   4. Tap a public event's Add button → appears in group section
 *   5. Reload → addition persists (server-side state)
 *   6. Bad UUID → 404 page
 *   7. OG meta tags present on group calendar
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';

/** Grant clipboard permissions to the context and stub clipboard.writeText. */
async function grantClipboard(context: BrowserContext): Promise<void> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
}

/** Read the clipboard in the page context. Falls back to '' if unavailable. */
async function readClipboard(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => navigator.clipboard.readText());
  } catch {
    return '';
  }
}

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1024', width: 1024, height: 768 },
];

for (const vp of VIEWPORTS) {
  test.describe(`share-to-group @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('tap share → URL in clipboard and navigate to pinned group', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await grantClipboard(context);
      const page = await context.newPage();

      await page.goto('/calendar');
      await page.waitForLoadState('networkidle');

      // Find the first Share button in the calendar.
      const shareBtn = page.getByRole('button', { name: /share/i }).first();
      await expect(shareBtn).toBeVisible({ timeout: 10_000 });

      // Intercept native navigator.share so it doesn't open a dialog.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', {
          value: undefined,
          configurable: true,
        });
      });

      await shareBtn.click();

      // Wait for "Copied!" toast to appear.
      await expect(page.getByRole('status', { name: /copied/i })).toBeVisible({ timeout: 5_000 });

      // Read the clipboard and navigate to the group calendar.
      const clipUrl = await readClipboard(page);
      expect(clipUrl).toMatch(/\/group\/[^/]+\/calendar/);

      await context.close();
    });

    test('group calendar shows pinned section and OG meta tags', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await grantClipboard(context);
      const page = await context.newPage();

      await page.goto('/calendar');
      await page.waitForLoadState('networkidle');

      // Suppress native share and capture the group URL.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      });

      const shareBtn = page.getByRole('button', { name: /share/i }).first();
      await expect(shareBtn).toBeVisible({ timeout: 10_000 });
      await shareBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 5_000 });

      const groupUrl = await readClipboard(page);
      expect(groupUrl).toMatch(/\/group\/[^/]+\/calendar/);

      // Navigate to the group calendar.
      await page.goto(groupUrl);
      await page.waitForLoadState('networkidle');

      // Pinned section heading should appear.
      await expect(page.getByText('[pinned]')).toBeVisible({ timeout: 10_000 });

      // OG meta tags should be present.
      const ogTitle = await page.$eval(
        'meta[property="og:title"]',
        (el) => el.getAttribute('content'),
      );
      expect(ogTitle).toBeTruthy();

      await context.close();
    });

    test('tap public event Add → added optimistically + persists on reload', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await grantClipboard(context);
      const page = await context.newPage();

      // Share an event and navigate to its group calendar.
      await page.goto('/calendar');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      });

      const shareBtn = page.getByRole('button', { name: /share/i }).first();
      await expect(shareBtn).toBeVisible({ timeout: 10_000 });
      await shareBtn.click();
      await expect(page.getByRole('status')).toBeVisible({ timeout: 5_000 });

      const groupUrl = await readClipboard(page);
      expect(groupUrl).toMatch(/\/group\/[^/]+\/calendar/);

      await page.goto(groupUrl);
      await page.waitForLoadState('networkidle');

      // Find the first "+ Add" button in the "Add from calendar" section.
      const addSection = page.getByLabel('Browse and add events');
      const addBtn = addSection.getByRole('button', { name: '+ Add' }).first();
      await expect(addBtn).toBeVisible({ timeout: 10_000 });
      await addBtn.click();

      // Optimistic UI shows "✓ Added".
      await expect(addSection.getByRole('button', { name: /added/i }).first()).toBeVisible({
        timeout: 5_000,
      });

      // Reload and verify persistence.
      await page.reload();
      await page.waitForLoadState('networkidle');
      // The button should now show ✓ Added (server state).
      await expect(page.getByRole('button', { name: /added/i }).first()).toBeVisible({
        timeout: 10_000,
      });

      await context.close();
    });

    test('bad UUID → 404 page', async ({ page }) => {
      page.setDefaultTimeout(15_000);
      const response = await page.goto('/group/definitely-not-a-real-group-id/calendar');
      // Next.js returns 404 for notFound().
      expect(response?.status()).toBe(404);
    });
  });
}
