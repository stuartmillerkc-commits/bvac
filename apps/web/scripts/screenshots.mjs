// Screenshots for docs/visual-pass: every key page and state at 1280px and 390px, light and dark.
// Usage (after pnpm build, with the site served on 4173 by scripts/serve-out.mjs):
//   node scripts/screenshots.mjs <outDir> [baseURL] [nameRegex]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2];
const base = process.argv[3] || 'http://localhost:4173';
const only = process.argv[4] ? new RegExp(process.argv[4]) : null;
fs.mkdirSync(out, { recursive: true });
const KEY = 'bvac-team-builder-demo-v1';

const PAGES = [
  ['home', '/'], ['tour', '/tour/'], ['finder', '/finder/'], ['finder-d3', '/finder/?division=D3'],
  ['register', '/register/'], ['preferences-picker', '/preferences/'], ['coach', '/coach/'],
  ['admin', '/admin/'], ['board-d1', '/admin/board/?d=D1'], ['board-d3', '/admin/board/?d=D3'],
  ['compare', '/admin/compare/'], ['settings', '/admin/settings/'], ['import', '/admin/import/'], ['exports', '/admin/exports/'],
];

const STATES = {
  async 'board-sent'(page) {
    await page.goto(base + '/admin/board/?d=D3', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Send round 1 to coaches' }).click();
    await page.waitForTimeout(300);
  },
  async 'coach-approve'(page) {
    await STATES['board-sent'](page);
    await page.locator('section[aria-labelledby="rounds-title"]').getByRole('status').getByRole('link').first().click();
    await page.waitForURL(/coach/); await page.waitForLoadState('networkidle');
  },
  async 'register-step3'(page) {
    await page.goto(base + '/register/?division=D3', { waitUntil: 'networkidle' });
    for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Fill in sample answers' }).click(); await page.getByRole('button', { name: 'Continue' }).click(); }
    await page.getByRole('button', { name: 'Fill in sample answers' }).click();
    await page.waitForTimeout(200);
  },
  async 'register-step4'(page) {
    await STATES['register-step3'](page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(200);
  },
  async 'register-receipt'(page) {
    await STATES['register-step4'](page);
    await page.getByRole('button', { name: /^Pay \$/ }).click();
    await page.getByRole('link', { name: 'Continue to team preferences' }).waitFor();
  },
  async 'preferences'(page) {
    await STATES['register-receipt'](page);
    await page.getByRole('link', { name: 'Continue to team preferences' }).click();
    await page.waitForURL(/preferences/); await page.waitForLoadState('networkidle');
    await page.waitForTimeout(200);
  },
};

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
  const jobs = [];
  for (const [name, url] of PAGES) jobs.push([name, (p) => p.goto(base + url, { waitUntil: 'networkidle' })]);
  for (const [name, fn] of Object.entries(STATES)) jobs.push([name, fn]);
  for (const [size, viewport] of Object.entries(sizes)) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scheme, isMobile: size === 'phone', hasTouch: size === 'phone' });
      for (const [name, fn] of jobs) {
        if (only && !only.test(name)) continue;
        const page = await ctx.newPage();
        await page.clock.setFixedTime(new Date('2026-12-01T12:00:00-06:00'));
        await page.goto(base + '/');
        await page.evaluate((k) => localStorage.removeItem(k), KEY);
        try {
          await fn(page);
          await page.evaluate(() => document.fonts && document.fonts.ready);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (overflow > 1) console.log('OVERFLOW', name, size, scheme, overflow);
          await page.screenshot({ path: path.join(out, `${name}-${size}-${scheme}.png`), fullPage: true });
        } catch (e) { console.log('FAIL', name, size, scheme, e.message.split('\n')[0]); }
        await page.close();
      }
      await ctx.close();
    }
  }
  await browser.close();
})();
