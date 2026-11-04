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

test('the rounds panel walks the admin through send, coach approval and publish', async ({ page }) => {
  await page.goto('/admin/board/?d=D3', { waitUntil: 'networkidle' });
  const panel = page.locator('section[aria-labelledby="rounds-title"]');
  await expect(panel.getByRole('status')).toContainText('Next step: send round 1 to coaches');
  await panel.getByRole('button', { name: 'Send round 1 to coaches' }).click();

  // Sending moves to step 2, hides the send button and points at the coaches.
  await expect(panel.getByRole('status')).toContainText(/Sent\. \d+ kids on \d+ teams are waiting for coaches/);
  await expect(panel.getByRole('button', { name: 'Send round 1 to coaches' })).toHaveCount(0);
  await expect(panel.locator('li[aria-current="step"]')).toHaveText(/Coaches approve/);

  // A coach approves from the link in the panel.
  await panel.getByRole('status').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/coach\/\?as=/);
  await expect(page.getByRole('status').first()).toContainText(/The admin sent you \d+ players? to approve/);
  await page.getByRole('button', { name: /^Approve roster/ }).click();
  await expect(page.getByRole('status').first()).toContainText('Thanks, you approved this roster');

  // The dashboard shows progress and the next step for the division.
  await page.goto('/admin/', { waitUntil: 'networkidle' });
  const row = page.locator('tbody tr', { has: page.getByRole('link', { name: 'Division 3' }) });
  await expect(row).toContainText(/Round 1: [1-9]\d* of \d+ approved by coaches/);
  await row.getByRole('link', { name: 'Check on coaches →' }).click();
  await expect(page).toHaveURL(/\/admin\/board\/\?d=D3/);

  // Admin approves the rest; publish becomes the next step, then round 2.
  await panel.getByRole('button', { name: /^Approve all as admin/ }).click();
  await expect(panel.getByRole('status')).toContainText('Next step: publish round 1');
  await panel.getByRole('button', { name: 'Publish round 1' }).click();
  await expect(panel.getByRole('status')).toContainText(/Round 1 is published: \d+ kids are on final teams/);
  await expect(panel.getByRole('button', { name: 'Send round 2 to coaches' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Undo last publish' })).toBeVisible();
});

test('registering from a Team Finder card pre-checks that team’s night and counts as early in the demo', async ({ page }) => {
  // Before early registration opens, a demo sign-up is treated like one on opening day.
  await page.clock.setFixedTime(new Date('2026-12-01T12:00:00-06:00'));
  await page.goto('/finder/?division=D3', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /^Register for Option B,/ }).click();
  await expect(page).toHaveURL(/\/register\/\?division=D3&first=/);
  await page.getByRole('button', { name: 'Fill in sample answers' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Fill in sample answers' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText(/We checked Mon because Option B practices Mon 6:30–7:30pm/)).toBeVisible();
  await expect(page.getByLabel('Mon', { exact: true })).toBeChecked();
  await expect(page.getByLabel('6:00–7:00pm')).toBeChecked();
  await expect(page.getByLabel('7:00–8:00pm')).toBeChecked();
  await expect(page.getByText('✓ Fits the days and times you checked').first()).toBeVisible();

  await page.getByLabel("No, they're preferences").check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/^Early registration\./)).toBeVisible();
});

test('full teams in a first come, first served division offer the waitlist instead of a normal sign-up', async ({ page }) => {
  await page.goto('/finder/?division=D1', { waitUntil: 'networkidle' });
  const full = page.locator('article', { has: page.getByText('Full · waitlist') }).first();
  await expect(full.getByRole('link', { name: /^Join the waitlist for Option/ })).toBeVisible();
  await expect(full).toContainText('Registering puts you on its waitlist');
});

test('the board explains its labels and lists what to check', async ({ page }) => {
  await page.goto('/admin/board/?d=D1', { waitUntil: 'networkidle' });
  await expect(page.locator('#flags summary')).toContainText(/\d+ things? to check/);
  await page.getByText('What the labels mean').click();
  await expect(page.getByText("Not one of their picks, but it fits their days and they said any team is OK.")).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Jump to a team' }).getByRole('link', { name: /^Waitlist \(\d+\)$/ })).toBeVisible();
  await expect(page.locator('#col-waitlist').getByText('Why waitlisted?').first()).toBeVisible();
});
