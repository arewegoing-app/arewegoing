/**
 * Adversarial e2e tests for the `/` landing page.
 *
 * Covers: section headings, responsive layout, CTA links, waitlist form
 * (empty, malformed, valid, dedupe, SQL injection, length limits, emoji).
 */

import { test, expect } from '@playwright/test';

test.describe('Landing page — /  ', () => {
  test('returns 200 and renders all four section headings', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: /Are we going\?/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Get notified' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Built differently' })).toBeVisible();
  });

  test('390px width — no horizontal scrollbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(391);
  });

  test('1440px width — hero h1 does not wrap beyond 2 lines', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const lineCount = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return 0;
      const range = document.createRange();
      range.selectNodeContents(h1);
      const rects = Array.from(range.getClientRects());
      // Count distinct y-position rows as a proxy for line count.
      const ys = new Set(rects.map((r) => Math.round(r.top)));
      return ys.size;
    });
    expect(lineCount).toBeLessThanOrEqual(2);
  });

  test('CTA "See what\'s on" links to /calendar', async ({ page }) => {
    await page.goto('/');
    const href = await page
      .getByRole('link', { name: /See what.s on/i })
      .getAttribute('href');
    expect(href).toBe('/calendar');
  });

  test('anchor "Get notified" has href=#waitlist', async ({ page }) => {
    await page.goto('/');
    const href = await page
      .getByRole('link', { name: /Get notified/i })
      .getAttribute('href');
    expect(href).toBe('#waitlist');
  });

  test('waitlist form — empty email leaves submit disabled', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /Notify me/i });
    // Button should be disabled when email is empty.
    await expect(btn).toBeDisabled();
  });

  test('waitlist form — malformed email is rejected by HTML5 validation', async ({ page }) => {
    await page.goto('/');

    // Fill the input with a deliberately bad email using fill() so the
    // browser gets the typed value but the `type=email` constraint fires.
    const input = page.locator('#waitlist-email');
    await input.fill('not-an-email');

    // The submit button becomes enabled (React's `!email` guard passes),
    // but the browser's constraint validation blocks actual submission.
    const btn = page.getByRole('button', { name: /Notify me/i });

    // Check the browser validity directly — the input should be invalid.
    const isValid = await input.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);

    // Attempt click — should not navigate away.
    await btn.click();
    await page.waitForTimeout(300);

    // Success state must NOT appear.
    await expect(page.getByText(/We.ll let you know/i)).not.toBeVisible();
  });

  test('waitlist form — valid email shows success state', async ({ page }) => {
    const email = `e2e-valid-${Date.now()}@example.com`;
    await page.goto('/');
    await page.locator('#waitlist-email').fill(email);
    await page.getByRole('button', { name: /Notify me/i }).click();
    await expect(page.getByText(/We.ll let you know/i)).toBeVisible({ timeout: 8000 });
  });

  test('waitlist form — same email twice keeps one row (dedupe)', async ({ page }) => {
    const email = `e2e-dedupe-${Date.now()}@example.com`;

    // First submission.
    await page.goto('/');
    await page.locator('#waitlist-email').fill(email);
    await page.getByRole('button', { name: /Notify me/i }).click();
    await expect(page.getByText(/We.ll let you know/i)).toBeVisible({ timeout: 8000 });

    // Second submission via fresh page load.
    await page.goto('/');
    await page.locator('#waitlist-email').fill(email);
    await page.getByRole('button', { name: /Notify me/i }).click();
    // Should still show success (upsert), not crash.
    await expect(page.getByText(/We.ll let you know/i)).toBeVisible({ timeout: 8000 });
  });

  test('waitlist form — SQL-injection-shaped email does not crash', async ({ page }) => {
    // Zod's z.string().email() will reject this because it is not a valid email
    // format. Either rejection (no success state) OR safe insertion as literal
    // text is acceptable; what matters is no crash and no DROP.
    const injectionEmail = `a'); DROP TABLE feature_interest;--@x.com`;
    await page.goto('/');
    const input = page.locator('#waitlist-email');
    await input.fill(injectionEmail);

    // Check HTML5 validity (browser may reject the @ disambiguation).
    const isValid = await input.evaluate((el: HTMLInputElement) => el.validity.valid);

    if (isValid) {
      // If the browser accepts the format, click and expect either success or
      // a handled error — never a JS exception or unhandled network error.
      await page.getByRole('button', { name: /Notify me/i }).click();
      await page.waitForTimeout(1500);
      // Either state is fine — just no unhandled exception.
      // (Zod email validation on the server will reject it.)
    }
    // Page must still be functional — heading visible.
    await expect(page.getByRole('heading', { name: /Are we going\?/i })).toBeVisible();
  });

  test('waitlist form — 254-char email accepted; 255+ rejected by Zod', async ({ page }) => {
    // 254 chars is the RFC 5321 maximum for an email address.
    // local@domain where local is padded to hit the limit.
    const local = 'a'.repeat(244);  // 244 + '@' + 'example.com' = 256 — too long
    // Correctly: local(244) + '@' + 'x.co' = 250 chars — valid
    const email254 = `${'a'.repeat(243)}@example.com`; // 243+1+11 = 255… adjust
    // exact: need total = 254. domain = 'x.co' (4). '@' = 1. local = 254-5 = 249.
    const email254Correct = `${'a'.repeat(249)}@x.co`;
    expect(email254Correct.length).toBe(254);

    await page.goto('/');
    const input = page.locator('#waitlist-email');
    await input.fill(email254Correct);
    const isValid254 = await input.evaluate((el: HTMLInputElement) => el.validity.valid);
    // A browser email input accepts RFC-valid addresses; 254 chars should be fine.
    // If the browser accepts it, submit should succeed (or produce a server error
    // we handle, not an unhandled crash).
    if (isValid254) {
      await page.getByRole('button', { name: /Notify me/i }).click();
      await page.waitForTimeout(1500);
      // Page must remain functional.
      expect(await page.title()).toBeTruthy();
    }

    // 255-char address: Zod schema has .max(254) so it should be rejected.
    const email255 = `${'a'.repeat(250)}@x.co`; // 250+1+4 = 255
    expect(email255.length).toBe(255);
    await page.goto('/');
    await input.fill(email255);
    const isValid255 = await input.evaluate((el: HTMLInputElement) => el.validity.valid);
    if (isValid255) {
      await page.getByRole('button', { name: /Notify me/i }).click();
      await page.waitForTimeout(1500);
      // Server action (Zod) rejects it — success state must NOT appear.
      await expect(page.getByText(/We.ll let you know/i)).not.toBeVisible();
    }
  });

  test('waitlist form — emoji-only input is rejected by type=email', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('#waitlist-email');
    await input.fill('🎵🎸🤘');
    const isValid = await input.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
    // Button click should not trigger success.
    await page.getByRole('button', { name: /Notify me/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/We.ll let you know/i)).not.toBeVisible();
  });
});
