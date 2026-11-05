import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests against the static export in ./out (run `pnpm build` first).
 * Locally the session's preinstalled Chromium is used when PW_CHROMIUM is set.
 */
const port = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /pages\.spec\.ts/ },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' }, testMatch: /pages\.spec\.ts/ },
    { name: 'mobile-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' }, testMatch: /pages\.spec\.ts/ },
  ],
  webServer: {
    command: `node scripts/serve-out.mjs ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
