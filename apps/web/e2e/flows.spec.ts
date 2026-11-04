import { expect, test, type Page } from '@playwright/test';

const STORAGE_KEY = 'bvac-team-builder-demo-v1';

async function savedEdits(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
});

test('a family registered through the mock form appears on the team board', async ({ page }) => {
  await page.goto('/register/?division=D3', { waitUntil: 'networkidle' });
  for (let step = 0; step < 3; step++) {
    await page.getByRole('button', { name: 'Fill in sample answers' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await page.getByRole('button', { name: /^Pay \$/ }).click();
  await expect(page.getByRole('link', { name: 'Continue to team preferences' })).toBeVisible();

  const added = (await savedEdits(page)).added;
  const player = added.players.at(-1);
  expect(player).toBeTruthy();
  await page.goto('/admin/board/?d=D3', { waitUntil: 'networkidle' });
  await expect(page.getByText(`${player.firstName} ${player.lastName}`).first()).toBeVisible();
});

test('moving a kid on the board persists after reload', async ({ page }) => {
  await page.goto('/admin/board/?d=D3', { waitUntil: 'networkidle' });
  const move = page.getByRole('combobox', { name: /^Move .+ to$/ }).first();
  const label = (await move.getAttribute('aria-label'))!;
  const target = await move.locator('option').nth(1).getAttribute('value');
  await move.selectOption(target!);
  await expect.poll(async () => (await savedEdits(page)).fixed?.length ?? 0).toBeGreaterThan(0);
  await page.reload({ waitUntil: 'networkidle' });
  const fixed = (await savedEdits(page)).fixed as { teamId: string | null; locked: boolean }[];
  expect(fixed.some((p) => p.locked && p.teamId === (target === 'waitlist' ? null : target))).toBe(true);
  await expect(page.getByRole('combobox', { name: label })).toBeVisible();
});

test('round 1 can be sent to coaches and published', async ({ page }) => {
  await page.goto('/admin/board/?d=D3', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Send round 1 to coaches' }).click();
  await page.getByRole('button', { name: 'Publish round 1' }).click();
  await expect(page.getByText(/^[1-9]\d* published$/)).toBeVisible();
  const fixed = (await savedEdits(page)).fixed as { state: string }[];
  expect(fixed.some((p) => p.state === 'published')).toBe(true);
});

test('the sample SportsEngine file imports new registrations', async ({ page }) => {
  await page.goto('/admin/import/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Use the sample file' }).click();
  await expect(page.locator('.badge', { hasText: /^8 new$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Add 8 new/ }).click();
  await expect(page.getByRole('status')).toContainText('Added.');
  expect((await savedEdits(page)).imported.registrations).toHaveLength(8);
});

test('the replay feed lists registrations as the date moves', async ({ page }) => {
  await page.goto('/admin/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Play from Jan 4' }).click();
  await expect(page.locator('.feed-day').first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.feed').getByText('registered →').first()).toBeVisible();
});
