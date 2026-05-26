// Comprehensive button-smoke test: hits every primary user surface, clicks
// every visible action, and fails if any of them throws a JS exception or a
// 500 server response. Validation errors (e.g. "field required") are not
// failures — those are expected UX.

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUTBOX = join(process.cwd(), '.gigs-outbox');
const BUYER = `buttons-${Date.now()}@test.local`;
const TS = Date.now();

function clearOutbox() {
  if (existsSync(OUTBOX)) rmSync(OUTBOX, { recursive: true, force: true });
}

type Captured = {
  pageErrors: string[];
  consoleErrors: string[];
  serverErrors: { url: string; status: number }[];
};

function capture(page: Page): Captured {
  const out: Captured = { pageErrors: [], consoleErrors: [], serverErrors: [] };
  page.on('pageerror', (e) => out.pageErrors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter Next.js / React dev-mode noise that isn't a real bug.
      if (/Hydration|Warning:|favicon\.ico/.test(text)) return;
      out.consoleErrors.push(text);
    }
  });
  page.on('response', (resp) => {
    if (resp.status() >= 500 && !resp.url().includes('favicon')) {
      out.serverErrors.push({ url: resp.url(), status: resp.status() });
    }
  });
  return out;
}

function assertClean(captured: Captured, label: string) {
  const lines: string[] = [];
  if (captured.pageErrors.length) lines.push(`pageerrors: ${captured.pageErrors.join(' | ')}`);
  if (captured.consoleErrors.length) lines.push(`console: ${captured.consoleErrors.join(' | ')}`);
  if (captured.serverErrors.length) lines.push(`500s: ${captured.serverErrors.map((s) => `${s.status} ${s.url}`).join(' | ')}`);
  if (lines.length) throw new Error(`${label}: ${lines.join('\n  ')}`);
}

async function signIn(page: Page) {
  await page.goto('/signin');
  await page.locator('input[name="email"]').fill(BUYER);
  await page.getByRole('button', { name: 'Continue' }).click();
  // Wait for redirect AWAY from /signin — not just any /gigs page.
  await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 15_000 });
}

test.describe('Buttons smoke — every page, every button', () => {
  test.setTimeout(90_000);
  test.beforeEach(() => clearOutbox());

  // Warm up /new once so the per-test compile cost doesn't blow the
  // first test that hits it. Next.js dev mode compiles pages on first request.
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/signin').catch(() => undefined);
    await page.goto('/new').catch(() => undefined);
    await ctx.close();
  });

  test('1. Calendar page (anon) — reaction buttons all fire', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cap = capture(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Next 90 days/ })).toBeVisible();

    // Welcome card dismiss.
    const dismissBtn = page.getByRole('button', { name: /Dismiss welcome/ }).first();
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click();
    }

    // Click each of the 6 reaction labels on the first card.
    for (const label of ['Interested', "I'm down", 'Pledge 1', 'Pledge 2', 'Got mine', "Can't"]) {
      const btn = page.getByRole('button', { name: label }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(150);
      }
    }

    // Follow a series if any card has one.
    const followBtn = page.getByRole('button', { name: /Follow series/ }).first();
    if (await followBtn.isVisible().catch(() => false)) {
      await followBtn.click();
      await page.waitForTimeout(300);
    }

    assertClean(cap, 'calendar anon');
    await ctx.close();
  });

  test('2. Sign in + your-gigs nav', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cap = capture(page);
    await signIn(page);
    await expect(page).toHaveURL('/');

    // Your-gigs link in nav.
    await page.getByRole('link', { name: 'Your gigs' }).click();
    await expect(page).toHaveURL(/\/mine/);

    // Owed link in nav.
    await page.getByRole('link', { name: 'Owed', exact: true }).click();
    await expect(page).toHaveURL(/\/owed/);

    assertClean(cap, 'signin + nav');
    await ctx.close();
  });

  test('3. New event page — autofill button + create', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cap = capture(page);
    await signIn(page);
    await page.goto('/new');

    // Autofill with a URL that won't resolve — graceful error, no crash.
    await page.locator('input[type="url"]').first().fill('https://example.com/no-such-event');
    await page.getByRole('button', { name: /Autofill/ }).click();
    await page.waitForTimeout(2000);
    // Should show an error message but not crash.

    // Create event with minimum fields.
    await page.locator('input[name="title"]').fill(`Smoke ${TS}`);
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.waitForURL(/\/gigs\/e\//, { timeout: 10_000 });

    assertClean(cap, 'new event');
    await ctx.close();
  });

  test('4. Event detail — share + invite buttons fire without errors', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cap = capture(page);
    await signIn(page);

    // Create an event to land on the detail page.
    await page.goto('/new');
    await page.locator('input[name="title"]').fill(`Detail-Smoke ${TS}`);
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.waitForURL(/\/e\//);

    // Share buttons row.
    const shareWa = page.getByRole('link', { name: /Share to WhatsApp/ });
    await expect(shareWa).toBeVisible();
    // Don't actually click (opens wa.me); verify href is well-formed.
    const href = await shareWa.getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\//);

    const copyBtn = page.getByRole('button', { name: /Copy share link|Link copied/ });
    await expect(copyBtn).toBeVisible();
    // Skipping actual click — clipboard API not always permitted in headless.

    const addCal = page.getByRole('link', { name: /Add to calendar/ });
    await expect(addCal).toBeVisible();
    const calHref = await addCal.getAttribute('href');
    expect(calHref).toMatch(/\/ics$/);

    // Refresh-from-source — should fail gracefully if no source URL.
    const refreshBtn = page.getByRole('button', { name: /Refresh from source/ });
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click();
      await page.waitForTimeout(500);
    }

    // Promo panel — Mark as asked.
    const markAskedBtn = page.getByRole('button', { name: /Mark as asked/ });
    if (await markAskedBtn.isVisible().catch(() => false)) {
      await markAskedBtn.click();
      await page.waitForTimeout(300);
    }

    // Public invite toggle.
    const enableInvite = page.getByRole('button', { name: /Enable/ });
    if (await enableInvite.isVisible().catch(() => false)) {
      await enableInvite.click();
      await page.waitForTimeout(500);
    }

    // Add a recipient + send invite.
    const recipEmail = `r-${TS}@test.local`;
    await page.locator('input[name="displayName"]').fill('Smoke Recipient');
    await page.locator('input[name="email"]').fill(recipEmail);
    await page.getByRole('button', { name: 'Add' }).click();
    await page.waitForTimeout(500);

    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
      await page.getByRole('button', { name: /Send invites/ }).click();
      await page.waitForTimeout(1500);
    }

    assertClean(cap, 'event detail buttons');
    await ctx.close();
  });

  test('5. Final call form fires (requires 1 going recipient)', async ({ browser, request }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cap = capture(page);
    await signIn(page);

    // Create event + invite + recipient says yes.
    await page.goto('/new');
    await page.locator('input[name="title"]').fill(`FC-Smoke ${TS}`);
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.waitForURL(/\/e\//);
    const recipEmail = `fc-${TS}@test.local`;
    await page.locator('input[name="displayName"]').fill('Smoke');
    await page.locator('input[name="email"]').fill(recipEmail);
    await page.getByRole('button', { name: 'Add' }).click();
    await page.waitForTimeout(400);
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: /Send invites/ }).click();
    await page.waitForTimeout(1500);

    // Pull the "I'm in" link out of the outbox and click it.
    const files = readdirSync(OUTBOX).filter((f) => f.endsWith('.json'));
    if (files.length) {
      const last = JSON.parse(readFileSync(join(OUTBOX, files[files.length - 1]), 'utf8'));
      const m = last.text.match(/I'm in:\s*(\S+)/);
      if (m) {
        await request.get(m[1], { maxRedirects: 0 });
      }
    }
    await page.reload();

    // Final call form should appear once 1+ is going.
    const startCallBtn = page.getByRole('button', { name: /Send final call/ });
    if (await startCallBtn.isVisible().catch(() => false)) {
      await page.locator('input[placeholder="Pledge $"]').fill('40');
      await page.locator('input[placeholder="Hours"]').fill('6');
      await startCallBtn.click();
      await page.waitForTimeout(1500);
    }

    assertClean(cap, 'final call');
    await ctx.close();
  });

  test('6. Respond page (recipient token) — all 4 status buttons + conditional', async ({ browser, request }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cap = capture(page);
    await signIn(page);
    await page.goto('/new');
    await page.locator('input[name="title"]').fill(`Respond-Smoke ${TS}`);
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.waitForURL(/\/e\//);
    const recipEmail = `respond-${TS}@test.local`;
    await page.locator('input[name="displayName"]').fill('R');
    await page.locator('input[name="email"]').fill(recipEmail);
    await page.getByRole('button', { name: 'Add' }).click();
    await page.waitForTimeout(400);
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: /Send invites/ }).click();
    await page.waitForTimeout(1500);

    // Grab respond link from the email.
    const files = readdirSync(OUTBOX).filter((f) => f.endsWith('.json'));
    const last = JSON.parse(readFileSync(join(OUTBOX, files[files.length - 1]), 'utf8'));
    const m = last.text.match(/Set conditions[^:]*:\s*(\S+)|respond[^:]*:\s*(\S+)|Got a condition[^:]*:\s*(\S+)/i);
    const respondUrl = m ? (m[1] ?? m[2] ?? m[3]) : null;

    if (respondUrl) {
      const recipientCtx = await browser.newContext();
      const rPage = await recipientCtx.newPage();
      const rCap = capture(rPage);
      await rPage.goto(respondUrl.replace(/^https?:\/\/[^/]+/, ''));

      // All 4 main status buttons.
      for (const label of ["I'm in", 'Got mine already', 'Maybe', "Can't this time"]) {
        const btn = rPage.getByRole('button', { name: label });
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await rPage.waitForTimeout(400);
        }
      }

      // Conditional — toggle min_going + save.
      const conditionalSave = rPage.getByRole('button', { name: /Save conditional yes/ });
      const minGoingCheckbox = rPage.locator('input[type="checkbox"]').first();
      if (await minGoingCheckbox.isVisible().catch(() => false)) {
        await minGoingCheckbox.check();
        await conditionalSave.click();
        await rPage.waitForTimeout(500);
      }

      assertClean(rCap, 'respond page');
      await recipientCtx.close();
    }

    void request;
    assertClean(cap, 'respond page (parent)');
    await ctx.close();
  });
});
