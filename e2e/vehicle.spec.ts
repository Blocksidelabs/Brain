import { expect, test, type Page } from '@playwright/test';

interface DebugHook {
  __BLOCKSIDE_DEBUG__?: {
    getPosition(): number[];
    getVehicleState(): {
      driving: boolean;
      name: string | null;
      speedKmh: number;
      condition: number;
    };
    getPrompt(): string | null;
    debugTeleport(x: number, z: number): void;
  };
}

// NOTE: every call must execute INSIDE the browser context — page.evaluate
// serializes its return value, which strips functions from objects.
const getPrompt = (page: Page) =>
  page.evaluate(() => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getPrompt());
const getVehicleState = (page: Page) =>
  page.evaluate(() => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getVehicleState());
const getPosition = (page: Page) =>
  page.evaluate(() => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getPosition());
const teleport = (page: Page, x: number, z: number) =>
  page.evaluate(
    (p) => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.debugTeleport(p.x, p.z),
    { x, z },
  );

// Condition-based waits — headless software rendering runs at a few FPS and
// per-frame dt is clamped, so fixed wall-clock holds would be unreliable.
const waitForSpeedAbove = (page: Page, kmh: number) =>
  page.waitForFunction(
    (min) => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getVehicleState().speedKmh > min,
    kmh,
    { timeout: 20000 },
  );
const waitForSpeedBelow = (page: Page, kmh: number) =>
  page.waitForFunction(
    (max) => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getVehicleState().speedKmh < max,
    kmh,
    { timeout: 20000 },
  );
const waitForMoved = (page: Page, before: number[], min: number) =>
  page.waitForFunction(
    ({ before, min }) => {
      const p = (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getPosition();
      return Math.hypot(p[0] - before[0], p[2] - before[2]) > min;
    },
    { before, min },
    { timeout: 20000 },
  );

test('drive loop: prompt, enter, accelerate, steer, handbrake, cameras, exit, walk', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.waitForFunction(
    () => Boolean((window as unknown as DebugHook).__BLOCKSIDE_DEBUG__),
    undefined,
    { timeout: 25000 },
  );
  await page.waitForTimeout(1200);

  // Stand next to the parked coupe on the coastal boulevard (test-only helper)
  await teleport(page, 323, 44);
  await page.waitForTimeout(800);

  // Interaction prompt appears near the vehicle
  await expect.poll(() => getPrompt(page), { timeout: 5000 }).toContain('ENTER');

  // E enters the vehicle
  await page.keyboard.press('e');
  await expect
    .poll(() => getVehicleState(page), { timeout: 5000 })
    .toMatchObject({ driving: true, name: 'VESPER GT' });

  // Accelerate until genuinely fast, then steer left
  await page.keyboard.down('w');
  await waitForSpeedAbove(page, 15);
  await page.waitForTimeout(800); // a little more throttle
  await page.keyboard.down('a');
  await page.waitForTimeout(900);
  await page.keyboard.up('a');
  await page.keyboard.up('w');

  // Handbrake slide
  await page.keyboard.down(' ');
  await page.waitForTimeout(700);
  await page.keyboard.up(' ');

  // Camera switch: cockpit then back to third person
  await page.keyboard.press('v');
  await page.waitForTimeout(700);
  await page.keyboard.press('v');
  await page.waitForTimeout(500);

  // Mid-drive capture: vehicle, third-person camera, speedometer HUD
  await page.screenshot({ path: 'test-results/phase3-driving.png' });

  // Brake to a stop and exit
  await page.keyboard.down('s');
  await waitForSpeedBelow(page, 20);
  await page.keyboard.up('s');
  await page.keyboard.press('e');
  await expect
    .poll(() => getVehicleState(page), { timeout: 5000 })
    .toMatchObject({ driving: false });

  // Character movement works again after exiting
  const before = await getPosition(page);
  await page.keyboard.down('w');
  await waitForMoved(page, before, 0.8);
  await page.keyboard.up('w');
  const after = await getPosition(page);
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.8);

  expect(errors).toEqual([]);
});
