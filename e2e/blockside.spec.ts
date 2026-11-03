import { expect, test } from '@playwright/test';

test('BLOCKSIDE boots into a playable city without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/BLOCKSIDE/);

  // Menu renders
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();

  // Start the game
  await page.getByRole('button', { name: 'PLAY' }).click();
  const canvas = page.locator('.game-host canvas');
  await expect(canvas).toBeVisible({ timeout: 20000 });

  // Let the world settle, then walk around
  await page.waitForTimeout(3000);
  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  await page.keyboard.up('w');

  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/blockside-smoke.png', fullPage: false });
});
