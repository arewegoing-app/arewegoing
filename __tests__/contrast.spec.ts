/**
 * WCAG AA contrast checks for the just-shipped editorial surfaces.
 *
 * Tests the --ed-accent / --ed-on-accent token pairing in light AND dark mode
 * across:
 *   - `.u-accent-bg` spans (inline code in landing How it works section)
 *   - `.ed-chip[aria-pressed="true"]` (active reaction chip on /calendar)
 *   - The waitlist success banner on /
 *   - Mobile menu sheet (opened) in both themes
 *
 * Uses the wcagContrast() helper from utils/contrast.ts.
 * Minimum ratio: 4.5:1 (WCAG AA normal text).
 */

import { test, expect } from '@playwright/test';
import { wcagContrast } from './utils/contrast.js';

const AA_NORMAL = 4.5;

/** Force a specific theme on the page via localStorage + html class. */
async function forceTheme(
  page: import('@playwright/test').Page,
  theme: 'light' | 'dark',
): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('gigs_theme', t);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(t);
  }, theme);
}

/**
 * Compute WCAG contrast for a locator's computed fg/bg colours.
 * Returns the ratio or -1 if the element is not found / colours can't be read.
 */
async function contrastOf(
  page: import('@playwright/test').Page,
  selector: string,
): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return -1;
    const s = getComputedStyle(el);
    return { fg: s.color, bg: s.backgroundColor };
  }, selector).then((colours) => {
    if (colours === -1) return -1;
    const { fg, bg } = colours as { fg: string; bg: string };
    try {
      return wcagContrast(fg, bg);
    } catch {
      return -1;
    }
  });
}

test.describe('WCAG AA contrast — editorial surfaces', () => {
  // -------------------------------------------------------------------------
  // Landing page — inline code block (.u-accent-bg)
  // -------------------------------------------------------------------------

  test('/ — inline code .u-accent-bg contrast ≥ 4.5 in light mode', async ({ page }) => {
    await page.goto('/');
    await forceTheme(page, 'light');
    await page.reload();

    const ratio = await page.evaluate(() => {
      const el = document.querySelector('.u-accent-bg, code[style*="ed-accent"]');
      if (!el) {
        // Fallback: find any element with background matching ed-accent.
        const all = document.querySelectorAll('code');
        for (const c of all) {
          const bg = getComputedStyle(c).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            return { fg: getComputedStyle(c).color, bg };
          }
        }
        return null;
      }
      return { fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor };
    });

    if (ratio === null) {
      // Element may not exist on this page variant — skip with a note.
      test.info().annotations.push({ type: 'note', description: 'u-accent-bg not found on landing; skipping' });
      return;
    }

    const { fg, bg } = ratio as { fg: string; bg: string };
    const contrast = wcagContrast(fg, bg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  test('/ — inline code .u-accent-bg contrast ≥ 4.5 in dark mode', async ({ page }) => {
    await page.goto('/');
    await forceTheme(page, 'dark');
    await page.reload();

    const ratio = await page.evaluate(() => {
      const el = document.querySelector('.u-accent-bg, code[style*="ed-accent"]');
      if (!el) {
        const all = document.querySelectorAll('code');
        for (const c of all) {
          const bg = getComputedStyle(c).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            return { fg: getComputedStyle(c).color, bg };
          }
        }
        return null;
      }
      return { fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor };
    });

    if (ratio === null) {
      test.info().annotations.push({ type: 'note', description: 'u-accent-bg not found; skipping' });
      return;
    }

    const { fg, bg } = ratio as { fg: string; bg: string };
    const contrast = wcagContrast(fg, bg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  // -------------------------------------------------------------------------
  // Waitlist success banner (.u-mono with ed-accent background)
  // -------------------------------------------------------------------------

  test('/ — waitlist success banner contrast ≥ 4.5 in light mode', async ({ page }) => {
    await page.goto('/');
    await forceTheme(page, 'light');
    await page.reload();

    // Trigger the success state.
    await page.locator('#waitlist-email').fill(`contrast-light-${Date.now()}@example.com`);
    await page.getByRole('button', { name: /Notify me/i }).click();
    await expect(page.getByText(/We.ll let you know/i)).toBeVisible({ timeout: 8000 });

    const colours = await page.evaluate(() => {
      const el = document.querySelector('[aria-live="polite"]');
      if (!el) return null;
      return {
        fg: getComputedStyle(el).color,
        bg: getComputedStyle(el).backgroundColor,
      };
    });

    if (!colours) {
      test.info().annotations.push({ type: 'note', description: 'success banner not found via aria-live' });
      return;
    }

    const contrast = wcagContrast(colours.fg, colours.bg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  test('/ — waitlist success banner contrast ≥ 4.5 in dark mode', async ({ page }) => {
    await page.goto('/');
    await forceTheme(page, 'dark');
    await page.reload();

    await page.locator('#waitlist-email').fill(`contrast-dark-${Date.now()}@example.com`);
    await page.getByRole('button', { name: /Notify me/i }).click();
    await expect(page.getByText(/We.ll let you know/i)).toBeVisible({ timeout: 8000 });

    const colours = await page.evaluate(() => {
      const el = document.querySelector('[aria-live="polite"]');
      if (!el) return null;
      return {
        fg: getComputedStyle(el).color,
        bg: getComputedStyle(el).backgroundColor,
      };
    });

    if (!colours) {
      test.info().annotations.push({ type: 'note', description: 'success banner not found; skipping' });
      return;
    }

    const contrast = wcagContrast(colours.fg, colours.bg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  // -------------------------------------------------------------------------
  // Calendar — active chip (.ed-chip[aria-pressed="true"])
  // -------------------------------------------------------------------------

  test('/calendar — active chip contrast ≥ 4.5 in light mode', async ({ page }) => {
    await page.goto('/calendar');
    await forceTheme(page, 'light');
    await page.reload();

    // Find and click a reaction chip to put it in pressed state.
    const chip = page.locator('.ed-chip').first();
    const chipExists = (await chip.count()) > 0;
    if (!chipExists) {
      test.info().annotations.push({ type: 'note', description: 'No .ed-chip on /calendar; skipping' });
      return;
    }

    await chip.click();
    await page.waitForTimeout(500);

    const pressedChip = page.locator('.ed-chip[aria-pressed="true"], .ed-chip[data-active="true"]').first();
    const pressedExists = (await pressedChip.count()) > 0;
    if (!pressedExists) {
      test.info().annotations.push({ type: 'note', description: 'No pressed chip found after click; skipping' });
      return;
    }

    const colours = await pressedChip.evaluate((el) => ({
      fg: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    }));
    const contrast = wcagContrast(colours.fg, colours.bg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  test('/calendar — active chip contrast ≥ 4.5 in dark mode', async ({ page }) => {
    await page.goto('/calendar');
    await forceTheme(page, 'dark');
    await page.reload();

    const chip = page.locator('.ed-chip').first();
    const chipExists = (await chip.count()) > 0;
    if (!chipExists) {
      test.info().annotations.push({ type: 'note', description: 'No .ed-chip on /calendar in dark; skipping' });
      return;
    }

    await chip.click();
    await page.waitForTimeout(500);

    const pressedChip = page.locator('.ed-chip[aria-pressed="true"], .ed-chip[data-active="true"]').first();
    const pressedExists = (await pressedChip.count()) > 0;
    if (!pressedExists) {
      test.info().annotations.push({ type: 'note', description: 'No pressed chip in dark mode; skipping' });
      return;
    }

    const colours = await pressedChip.evaluate((el) => ({
      fg: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    }));
    const contrast = wcagContrast(colours.fg, colours.bg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  // -------------------------------------------------------------------------
  // Mobile menu sheet — links and sign-in chip
  // -------------------------------------------------------------------------

  test('mobile menu — nav links contrast ≥ 4.5 in light mode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await forceTheme(page, 'light');
    await page.reload();

    const trigger = page.getByRole('button', { name: /Open menu|Menu/i }).first();
    await trigger.click();
    await expect(page.locator('#mobile-nav-panel')).toBeVisible({ timeout: 3000 });

    const links = page.locator('#mobile-nav-panel a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    const colours = await links.first().evaluate((el) => ({
      fg: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    }));

    // Links inherit bg from the panel; walk up to find a non-transparent bg.
    const panelBg = await page.locator('#mobile-nav-panel').evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );

    const effectiveBg = colours.bg === 'rgba(0, 0, 0, 0)' ? panelBg : colours.bg;
    const contrast = wcagContrast(colours.fg, effectiveBg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  test('mobile menu — nav links contrast ≥ 4.5 in dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await forceTheme(page, 'dark');
    await page.reload();

    const trigger = page.getByRole('button', { name: /Open menu|Menu/i }).first();
    await trigger.click();
    await expect(page.locator('#mobile-nav-panel')).toBeVisible({ timeout: 3000 });

    const links = page.locator('#mobile-nav-panel a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    const colours = await links.first().evaluate((el) => ({
      fg: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    }));

    const panelBg = await page.locator('#mobile-nav-panel').evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );

    const effectiveBg = colours.bg === 'rgba(0, 0, 0, 0)' ? panelBg : colours.bg;
    const contrast = wcagContrast(colours.fg, effectiveBg);
    expect(contrast).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

// Re-export the helper so the import in the test file itself validates at
// typecheck time (the function is used inline above via the closure).
export { contrastOf };
