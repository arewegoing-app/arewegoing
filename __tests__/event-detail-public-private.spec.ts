/**
 * Lock-in tests for the public/private split on /e/[slug].
 *
 * Per the integration spec: group-private details (RSVP totals, final call,
 * pledge form, claim form) MUST NOT appear on the public /e/[slug] surface
 * for non-owner viewers. The owner view is currently implicitly the "group
 * view" at /e/[slug]; the longer-term plan is to move owner controls under
 * /group/[uuid]/e/[slug] — until then, these tests guard the boundary.
 */

import { test, expect } from '@playwright/test';

const PRIVATE_MARKERS = [
  'Going',
  'Pledged',
  'Final call',
  'Pending',
];

test.describe('/e/[slug] — public/private boundary', () => {
  test('anonymous viewer of someone-else-owned event sees only public surface', async ({
    page,
    context,
  }) => {
    // Clear any prior session cookies — we're testing the anon case.
    await context.clearCookies();

    // Find any event from /calendar that links to /e/[slug].
    await page.goto('/calendar');
    const detailLink = page.locator('a[href^="/e/"]').first();
    const count = await detailLink.count();
    if (count === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'No /e/[slug] links on /calendar in this environment; skipping',
      });
      return;
    }

    const href = await detailLink.getAttribute('href');
    await page.goto(href!);

    // Public view marker — the page should announce itself.
    // (When the page IS the public view, "Public view" appears. When it's the
    // owner view, it does not. Owner viewers see RSVP stats, public viewers
    // see a stripped card. We allow either: assert that IF the page is owner
    // view, this anonymous browser shouldn't have reached it.)
    const publicMarker = await page.getByText('Public view').count();
    const ticketCta = await page.getByTestId('event-detail-ticket-link').count();

    if (publicMarker === 0) {
      // We're seeing the owner view. That means either (a) the event is
      // anonymously owned and we happen to share its cookie, or (b) the
      // app is leaking owner UI to non-owners. Surface as a test failure
      // so the regression is loud.
      const leakedRsvp = await Promise.all(
        PRIVATE_MARKERS.map((label) => page.getByText(label, { exact: true }).count()),
      );
      const totalLeaked = leakedRsvp.reduce((acc, n) => acc + n, 0);

      expect(
        totalLeaked,
        `Anonymous viewer should not see owner-only RSVP labels; found ${totalLeaked} of ${PRIVATE_MARKERS.join(', ')}`,
      ).toBe(0);
    } else {
      // Public view is being rendered — perfect. Verify no group-private
      // controls leaked in.
      for (const label of PRIVATE_MARKERS) {
        await expect(
          page.getByText(label, { exact: true }),
          `Public view should not render "${label}" stat`,
        ).toHaveCount(0);
      }
    }

    // Ticket CTA SHOULD appear if the event has a ticketUrl (it's public info).
    // We don't assert it must exist (some events have no ticket URL), but if
    // it does it must use withRef.
    if (ticketCta > 0) {
      const href = await page.getByTestId('event-detail-ticket-link').getAttribute('href');
      expect(href).toContain('ref=arewegoing');
    }
  });

  test('FinalCallForm / claim form / pledge controls are NOT in the rendered HTML for anon viewers', async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/calendar');
    const detailLink = page.locator('a[href^="/e/"]').first();
    if ((await detailLink.count()) === 0) return;

    const href = await detailLink.getAttribute('href');
    await page.goto(href!);

    // Form actions / IDs that the owner view exposes.
    const finalCall = await page.locator('form[action*="final-call"], button:has-text("Final call")').count();
    const claim = await page.locator('form[action*="claim"], button:has-text("Claim")').count();
    const pledge = await page.locator('button:has-text("Pledge"), form[action*="pledge"]').count();

    expect(finalCall + claim + pledge, 'No owner-only forms should render for anon').toBe(0);
  });
});
