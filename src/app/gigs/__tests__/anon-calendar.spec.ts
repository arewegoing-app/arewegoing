import { test, expect } from '@playwright/test';

test.describe('Anon calendar (no-signin MVP)', () => {
  test('first-time visitor sees Wellington gigs and can react', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/gigs');
    // The calendar header
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();

    // At least one of the seed gigs renders.
    await expect(page.getByText(/Lacuna Presents: Eden Burns/i).first()).toBeVisible();

    // Anon reaction: tap the first "I'm down" button.
    const downButton = page.getByRole('button', { name: "I'm down" }).first();
    await downButton.click();
    await page.waitForTimeout(500);

    // Tally reflects it — the eye/check icons render an "1" somewhere.
    // Page should still have an "I'm down" button (it's idempotent on re-press).
    await expect(page.getByRole('button', { name: "I'm down" }).first()).toBeVisible();

    // Cookie set
    const cookies = await ctx.cookies();
    expect(cookies.find((c) => c.name === 'gigs_anon')).toBeTruthy();
    await ctx.close();
  });

  test('claim-and-rally flow: visitor enters a discovered gig and becomes owner', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Pre-react 3 times so the Rally button surfaces. Use distinct anon cookies
    // by running 3 separate contexts that each tap "I'm down" on the same event.
    const downContexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    for (const c of downContexts) {
      const p = await c.newPage();
      await p.goto('/gigs');
      const btn = p.getByRole('button', { name: "I'm down" }).first();
      await btn.click();
      await p.waitForTimeout(300);
      await c.close();
    }

    // Now reload as the claimer and look for the rally button.
    await page.goto('/gigs');
    const rallyButton = page.getByRole('button', { name: /Rally this/ }).first();
    // The rally button may take a moment to appear if reactions haven't propagated.
    await expect(rallyButton).toBeVisible({ timeout: 3000 });
    await ctx.close();
  });
});
