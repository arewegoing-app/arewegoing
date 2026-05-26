import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUTBOX = join(process.cwd(), '.gigs-outbox');

function clearOutbox() {
  if (existsSync(OUTBOX)) rmSync(OUTBOX, { recursive: true, force: true });
}

function readOutboxEmails(): Array<{ to: string; subject: string; text: string; html: string }> {
  if (!existsSync(OUTBOX)) return [];
  return readdirSync(OUTBOX)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(OUTBOX, f), 'utf8')));
}

function extractActionLink(text: string, action: 'in' | 'maybe' | 'out'): string {
  const labels = { in: "I'm in:", maybe: 'Maybe:', out: 'Not this time:' };
  const m = text.match(new RegExp(`${labels[action].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\S+)`));
  if (!m) throw new Error(`No ${action} link found in: ${text}`);
  return m[1];
}

async function signInAs(page: Page, email: string) {
  await page.goto('/signin');
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/gigs$/);
}

async function createEventAndInvite(page: Page, title: string, recipientEmail: string) {
  await page.getByRole('link', { name: 'New event' }).click();
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="venue"]').fill('San Fran');
  await page.getByRole('button', { name: 'Create event' }).click();
  await page.waitForURL(/\/gigs\/e\//);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  await page.locator('input[name="displayName"]').fill('Test Recipient');
  await page.locator('input[name="email"]').fill(recipientEmail);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /Send invites/ }).click();
  await page.waitForTimeout(1500);
}

test.describe('Slice 0 — Foundation', () => {
  test.beforeEach(() => clearOutbox());

  test('buyer creates event, sends invite, recipient clicks Im in, RSVP recorded', async ({ browser, request }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const buyerEmail = `buyer-1-${Date.now()}@test.local`;
    const recipientEmail = `r-1-${Date.now()}@test.local`;

    await signInAs(page, buyerEmail);
    await createEventAndInvite(page, 'Solid State 2.0 — E2E', recipientEmail);

    const emails = readOutboxEmails().filter((e) => e.to === recipientEmail);
    expect(emails.length).toBe(1);
    const inLink = extractActionLink(emails[0].text, 'in');
    const res = await request.get(inLink);
    expect(res.ok()).toBeTruthy();

    await page.reload();
    await expect(page.locator('text=going').first()).toBeVisible();
    await ctx.close();
  });

  test('token replay: second click is a no-op with replay flag', async ({ browser, request }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const buyerEmail = `buyer-2-${Date.now()}@test.local`;
    const recipientEmail = `r-2-${Date.now()}@test.local`;

    await signInAs(page, buyerEmail);
    await createEventAndInvite(page, 'Replay test', recipientEmail);

    const emails = readOutboxEmails().filter((e) => e.to === recipientEmail);
    expect(emails.length).toBe(1);
    const inLink = extractActionLink(emails[0].text, 'in');

    const first = await request.get(inLink, { maxRedirects: 0 });
    const firstLocation = first.headers()['location'] ?? '';
    expect(firstLocation).toContain('status=going');
    expect(firstLocation).not.toContain('replay=1');

    const second = await request.get(inLink, { maxRedirects: 0 });
    const secondLocation = second.headers()['location'] ?? '';
    expect(secondLocation).toContain('replay=1');
    await ctx.close();
  });
});
