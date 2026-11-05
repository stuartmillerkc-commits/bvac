import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES: [string, RegExp][] = [
  ['/', /Teams that fit/],
  ['/tour/', /Guided tour/],
  ['/finder/', /Team Finder|Find a team/i],
  ['/register/', /./],
  ['/preferences/', /./],
  ['/coach/', /Coach view/],
  ['/admin/', /Season dashboard/],
  ['/admin/board/', /./],
  ['/admin/compare/', /./],
  ['/admin/settings/', /./],
  ['/admin/import/', /Import from SportsEngine/],
  ['/admin/exports/', /Exports for SportsEngine/],
];

for (const [path, heading] of PAGES) {
  test(`${path} loads without console errors`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('h1').first()).toHaveText(heading);
    await expect(page).toHaveTitle(/BVAC Team Builder/);
    // Nothing wider than the viewport on phones.
    if (info.project.name.startsWith('mobile')) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });
}

test.describe('accessibility', () => {
  for (const [path] of PAGES) {
    // Runs in every project that matches this file: desktop and phone, light and dark.
    test(`${path} has no serious axe violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(serious).toEqual([]);
    });
  }
});
