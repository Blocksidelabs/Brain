import { expect, test } from '@playwright/test';

interface DebugHook {
  __BLOCKSIDE_DEBUG__?: { getPosition(): number[] };
}

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

  // Wait for the simulation loop to be live
  await page.waitForFunction(
    () => Boolean((window as unknown as DebugHook).__BLOCKSIDE_DEBUG__),
    undefined,
    { timeout: 20000 },
  );
  await page.waitForTimeout(1500);

  // Actual gameplay verification: walking must move the player west (W with
  // the spawn camera facing downtown). Condition-based wait — robust against
  // headless software-rendering framerates (dt is clamped per frame).
  const readPos = () =>
    page.evaluate(
      () => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getPosition(),
    );
  const before = await readPos();
  await page.keyboard.down('w');
  await page.waitForFunction(
    (b) => {
      const p = (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getPosition();
      return Math.hypot(p[0] - b[0], p[2] - b[2]) > 1.5;
    },
    before,
    { timeout: 20000 },
  );
  await page.keyboard.up('w');
  const after = await readPos();

  const dist = Math.hypot(after[0] - before[0], after[2] - before[2]);
  expect(dist).toBeGreaterThan(1.5);
  expect(after[0]).toBeLessThan(before[0]);

  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/blockside-smoke.png', fullPage: false });
});
