import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm --ignore-workspace dev',
    url: 'http://localhost:3000/signin',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      GIGS_TEST_AUTH: '1',
      NODE_ENV: 'development',
      // NextAuth requires a secret even in dev; without it server actions return 400.
      AUTH_SECRET: 'playwright-test-secret-do-not-use-in-production',
    },
  },
});
