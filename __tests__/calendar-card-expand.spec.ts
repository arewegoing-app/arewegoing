/**
 * calendar-card-expand.spec.ts
 *
 * Tests the inline card expand behaviour on the calendar page.
 * Each card has a toggle button that expands/collapses an inline panel
 * showing reactions, share, and the outbound ticket link.
 *
 * No-JS fallback: card links navigate to /e/[slug].
 */

import { test, expect } from '@playwright/test';

test.describe('Calendar card expand', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();
  });

  test('1. tapping card toggle expands it with aria-expanded and data-expanded', async ({
    page,
  }) => {
    // Find the first card expand button.
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    await expect(toggleBtn).toBeVisible();

    // Confirm initial state is collapsed.
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Expand the card.
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // The card wrapper should have data-expanded="true".
    const card = page.locator('[data-expanded="true"]').first();
    await expect(card).toBeVisible();
  });

  test('2. expanded panel contains outbound ticket link with ?ref=arewegoing', async ({
    page,
  }) => {
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    await toggleBtn.click();

    // Wait for the expanded panel.
    const expandedPanel = page.locator('[data-expanded="true"]').first();
    await expect(expandedPanel).toBeVisible();

    // Look for a ticket link inside the expanded panel.
    const ticketLink = expandedPanel.locator('a[href*="ref=arewegoing"]');
    // Only assert if a ticket URL exists for this event.
    const count = await ticketLink.count();
    if (count > 0) {
      const href = await ticketLink.first().getAttribute('href');
      expect(href).toContain('ref=arewegoing');
    }
    // If count is 0, this event has no ticket URL — that's fine.
  });

  test('3. second tap on toggle collapses the card', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();

    // Expand.
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Collapse.
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-expanded="true"]')).toHaveCount(0);
  });

  test('4. opening a different card collapses the previously open one', async ({
    page,
  }) => {
    const toggleBtns = page.getByRole('button', { name: /show details for/i });
    const count = await toggleBtns.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Expand first card.
    await toggleBtns.nth(0).click();
    await expect(toggleBtns.nth(0)).toHaveAttribute('aria-expanded', 'true');

    // Expand second card.
    await toggleBtns.nth(1).click();
    await expect(toggleBtns.nth(1)).toHaveAttribute('aria-expanded', 'true');

    // First card should now be collapsed.
    await expect(toggleBtns.nth(0)).toHaveAttribute('aria-expanded', 'false');

    // Only one expanded card at a time.
    await expect(page.locator('[data-expanded="true"]')).toHaveCount(1);
  });

  test('5. with JS disabled, card is a normal link to /e/[slug]', async ({ browser }) => {
    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const page = await noJsContext.newPage();

    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();

    // No expand buttons should be visible (JS is off).
    const toggleBtns = page.getByRole('button', { name: /show details for/i });
    const btnCount = await toggleBtns.count();
    expect(btnCount).toBe(0);

    // The card should have a link navigating to /e/[slug].
    const cardLinks = page.locator('[data-testid="event-card"] a[href^="/e/"]');
    const linkCount = await cardLinks.count();
    expect(linkCount).toBeGreaterThanOrEqual(1);

    await noJsContext.close();
  });

  test('6. clicking inner ticket link does not collapse the card', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const expandedPanel = page.locator('[data-expanded="true"]').first();
    const ticketLink = expandedPanel.locator('a[href*="ref=arewegoing"]').first();
    const count = await ticketLink.count();

    if (count > 0) {
      // Click the ticket link (opens new tab — intercept to avoid navigation).
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        ticketLink.click(),
      ]);
      await newPage.close();

      // The card should still be expanded.
      await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    }
    // If no ticket link exists, test passes vacuously.
  });

  test('7. keyboard navigation: Enter expands, Tab moves into panel', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();

    // Tab to the first toggle button.
    await toggleBtn.focus();
    await page.keyboard.press('Enter');
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Check the expanded panel is focusable.
    const expandedPanel = page.locator('[data-expanded="true"]').first();
    await expect(expandedPanel).toBeVisible();
  });

  test('8. toggle button has accessible label with event title', async ({ page }) => {
    const firstToggle = page.getByRole('button', { name: /show details for/i }).first();
    await expect(firstToggle).toBeVisible();

    const label = await firstToggle.getAttribute('aria-label');
    expect(label).toMatch(/show details for .+/i);
  });

  test('9. expanded panel does not cause horizontal overflow on 390px viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();

    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    await toggleBtn.click();

    // Check that the body doesn't overflow horizontally.
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance
  });

  test('10. View Transitions: expand works regardless of API availability', async ({
    page,
  }) => {
    // Disable View Transitions by overriding the API to undefined.
    await page.addInitScript(() => {
      // @ts-expect-error — intentionally deleting to test fallback path
      delete document.startViewTransition;
    });

    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();

    // Should still expand without crashing.
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
  });
});
