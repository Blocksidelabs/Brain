import { expect, test, type Page } from '@playwright/test';

interface DebugHook {
  __BLOCKSIDE_DEBUG__?: {
    getPosition(): number[];
    getPedState(): { count: number; positions: number[][] };
    getTrafficState(): { count: number; positions: number[][] };
    getLightState(): { axis: 0 | 1; inYellow: boolean };
    debugSetHour(h: number): void;
    debugTeleport(x: number, z: number): void;
  };
}

const pedState = (page: Page) =>
  page.evaluate(() => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getPedState());
const trafficState = (page: Page) =>
  page.evaluate(() => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getTrafficState());
const lightState = (page: Page) =>
  page.evaluate(() => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.getLightState());
const setHour = (page: Page, h: number) =>
  page.evaluate((v) => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.debugSetHour(v), h);
const teleport = (page: Page, x: number, z: number) =>
  page.evaluate(
    (p) => (window as unknown as DebugHook).__BLOCKSIDE_DEBUG__!.debugTeleport(p.x, p.z),
    { x, z },
  );

test('living city: pedestrians walk, traffic drives, lights cycle, screenshots', async ({
  page,
}) => {
  const errors: string[] = [];
  // Filter out AudioContext errors common in headless environments
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('AudioContext')) errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    if (!e.message.includes('AudioContext')) errors.push(`pageerror: ${e.message}`);
  });

  // Force low quality in headless environments to prevent GPU crashes
  await page.addInitScript(() => {
    window.localStorage.setItem('blockside.settings.v1', JSON.stringify({ quality: 'low', musicOn: false }));
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.waitForFunction(
    () => Boolean((window as unknown as DebugHook).__BLOCKSIDE_DEBUG__),
    undefined,
    { timeout: 30000 },
  );

  // daytime downtown for the first pass
  await setHour(page, 12);
  await teleport(page, 10, -30); // plaza edge, downtown
  await page.waitForTimeout(1500);

  // pedestrians spawn near the player and MOVE
  await expect
    .poll(() => pedState(page).then((s) => s.count), { timeout: 20000 })
    .toBeGreaterThan(2);
  const p0 = await pedState(page);
  await page.waitForTimeout(1800);
  const p1 = await pedState(page);
  const pedMoved = Math.hypot(
    (p1.positions[0]?.[0] ?? 0) - (p0.positions[0]?.[0] ?? 0),
    (p1.positions[0]?.[1] ?? 0) - (p0.positions[0]?.[1] ?? 0),
  );
  expect(pedMoved).toBeGreaterThan(0.4);

  // AI traffic spawns and MOVES along routes
  await expect
    .poll(() => trafficState(page).then((s) => s.count), { timeout: 20000 })
    .toBeGreaterThan(1);
  const t0 = await trafficState(page);
  await page.waitForTimeout(1800);
  const t1 = await trafficState(page);
  const carMoved = Math.hypot(
    (t1.positions[0]?.[0] ?? 0) - (t0.positions[0]?.[0] ?? 0),
    (t1.positions[0]?.[1] ?? 0) - (t0.positions[0]?.[1] ?? 0),
  );
  expect(carMoved).toBeGreaterThan(1.5);

  // traffic lights actually cycle between axes
  await expect
    .poll(
      async () => {
        const a = await lightState(page);
        await page.waitForTimeout(2500);
        const b = await lightState(page);
        return a.axis !== b.axis || (a.inYellow !== b.inYellow ? 1 : 0);
      },
      { timeout: 25000 },
    )
    .toBe(true);

  // ---- screenshot tour ----
  await teleport(page, 30, -20);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/tour-downtown-day.png' });

  await setHour(page, 21.6);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/tour-downtown-night.png' });

  await setHour(page, 12);
  await teleport(page, 315, 0); // beachfront
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/tour-beach.png' });

  await teleport(page, 323, 44); // beside the parked coupe
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/tour-beside-vehicle.png' });

  expect(errors).toEqual([]);
});
