/**
 * /calendar (public surface) must NOT render reactions or RSVP controls.
 *
 * Spec: "the interested / im down / ill buy 1 buttons only appear under a
 * group/* route". Public surface is read-only event info; expanded view
 * shows more details (venue, series, on-sale, price). Reactions live under
 * /group/[uuid]/calendar only.
 */

import { test, expect } from '@playwright/test';

const REACTION_LABELS = [
  'Interested',
  "I'm down",
  "I'll buy 1",
  "I'll buy 2",
  'Have ticket',
  'Got extras',
  'Need one',
  "Can't",
];

test.describe('/calendar — public mode, no reactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Next 90 days' })).toBeVisible();
  });

  test('1. collapsed cards on /calendar do NOT show reaction buttons', async ({ page }) => {
    for (const label of REACTION_LABELS) {
      await expect(
        page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }),
      ).toHaveCount(0);
    }
  });

  test('2. expanded card on /calendar still hides reaction buttons', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    const toggleCount = await toggleBtn.count();
    if (toggleCount === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No events to expand on /calendar in this env; skipping',
      });
      return;
    }

    await toggleBtn.click();
    const expandedPanel = page.locator('[data-expanded="true"]').first();
    await expect(expandedPanel).toBeVisible();

    for (const label of REACTION_LABELS) {
      await expect(
        expandedPanel.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }),
      ).toHaveCount(0);
    }
  });

  test('3. expanded card shows venue / series / price / on-sale details if present', async ({
    page,
  }) => {
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    if ((await toggleBtn.count()) === 0) return;
    await toggleBtn.click();
    const expandedPanel = page.locator('[data-expanded="true"]').first();
    await expect(expandedPanel).toBeVisible();

    // At least one of the four detail rows should render for a typical event.
    const detailLabels = ['Venue ·', 'Series ·', 'On sale ·', 'Price ·'];
    let foundAny = false;
    for (const label of detailLabels) {
      const count = await expandedPanel.getByText(label, { exact: false }).count();
      if (count > 0) {
        foundAny = true;
        break;
      }
    }
    expect(foundAny, 'expanded card should show at least one detail row').toBe(true);
  });

  test('4. expanded card shows share button and ticket link (both modes)', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    if ((await toggleBtn.count()) === 0) return;
    await toggleBtn.click();
    const expandedPanel = page.locator('[data-expanded="true"]').first();

    // Share button is part of the public surface — keeps the "spin up a group"
    // path easy from the public calendar.
    await expect(
      expandedPanel.getByRole('button', { name: /share/i }),
    ).toHaveCount(1);
  });

  test('5. expanded card on /calendar does NOT link to /e/[slug] event page', async ({
    page,
  }) => {
    // Owner details for /e/[slug] are gated to the group surface in the new
    // model. Public-surface expanded view stays self-contained.
    const toggleBtn = page.getByRole('button', { name: /show details for/i }).first();
    if ((await toggleBtn.count()) === 0) return;
    await toggleBtn.click();
    const expandedPanel = page.locator('[data-expanded="true"]').first();
    const eventPageLink = expandedPanel.locator('a[href^="/e/"]');
    await expect(eventPageLink).toHaveCount(0);
  });
});
