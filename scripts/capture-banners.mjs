// BLOCKSIDE banner capture — drives the real game (three.js build served by
// `npm run preview`) in headless Chromium and saves raw 1920x1080 frames used
// for the 10 promotional banner composites.
//
// Usage (from the blockside/ folder):
//   node scripts/capture-banners.mjs
//   ONLY=sunny,rain QUALITY=medium node scripts/capture-banners.mjs
//
// Requires the preview server on :4173:
//   npm run preview -- --port 4173 --strictPort
//
// NOTE: uses the __BLOCKSIDE_DEBUG__ test hook (debugSetHour / debugTeleport /
// debugSetWeather / debugCameraPose). Every frame is the real engine rendering
// the real city — no faked imagery.

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const QUALITY = process.env.QUALITY || 'medium';
const OUT = path.join(ROOT, 'banner-captures', QUALITY);
fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Boot the game with a pre-seeded settings store (quality/weather/paused time). */
async function boot(page, { weather = 'sunny' } = {}) {
  await page.addInitScript(([q, w]) => {
    window.localStorage.setItem(
      'blockside.settings.v1',
      JSON.stringify({
        quality: q,
        musicOn: false,
        masterVolume: 0,
        weather: w,
        autoWeather: false,
        timeSpeed: 'paused',
      }),
    );
  }, [QUALITY, weather]);
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await page.waitForFunction(() => Boolean(window.__BLOCKSIDE_DEBUG__), undefined, {
    timeout: 90000,
  });
  await sleep(1200);
}

const setHour = (page, h) =>
  page.evaluate((v) => window.__BLOCKSIDE_DEBUG__.debugSetHour(v), h);
const teleport = (page, x, z) =>
  page.evaluate((p) => window.__BLOCKSIDE_DEBUG__.debugTeleport(p[0], p[1]), [x, z]);
const setWeather = (page, w) =>
  page.evaluate((v) => window.__BLOCKSIDE_DEBUG__.debugSetWeather(v), w);
/** Place the free camera: [px,py,pz, lookX,lookY,lookZ] */
const pose = (page, p) =>
  page.evaluate(
    ([a, b, c, d, e, f]) => window.__BLOCKSIDE_DEBUG__.debugCameraPose(a, b, c, d, e, f),
    p,
  );

async function waitWeather(page, type, timeout = 90000) {
  await page.waitForFunction(
    (t) => {
      const w = window.__BLOCKSIDE_DEBUG__.debugGetWeather();
      return w.current === t && w.target === t;
    },
    type,
    { timeout },
  );
}
async function waitWetness(page, min, timeout = 120000) {
  await page.waitForFunction(
    (m) => window.__BLOCKSIDE_DEBUG__.debugGetWeather().wetness >= m,
    min,
    { timeout },
  );
}
async function waitPopulation(page, { peds = 0, cars = 0, timeout = 60000 } = {}) {
  await page.waitForFunction(
    ({ peds, cars }) => {
      const d = window.__BLOCKSIDE_DEBUG__;
      return d.getPedState().count >= peds && d.getTrafficState().count >= cars;
    },
    { peds, cars },
    { timeout },
  );
}

/** Hide every HUD element for clean banner plates. */
const HUD_HIDE = '.hud{display:none!important}';
async function hideHud(page) {
  await page.addStyleTag({ content: HUD_HIDE });
}

async function shoot(page, name, settleMs = 1200) {
  await sleep(settleMs); // guarantee at least one rendered frame with the new pose
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('captured', name);
}

/* ------------------------------------------------------------------ */
/* Group A — clear weather: day, golden hour and night shots           */
/* ------------------------------------------------------------------ */

async function groupSunny(page) {
  // 02 — explore: street canyon pointing into downtown, life on the street
  await setHour(page, 10);
  await waitPopulation(page, { peds: 5, cars: 2 });
  await pose(page, [6, 2.3, -93, 6, 24, 235]);
  await hideHud(page);
  await shoot(page, 'raw-02-explore.png');

  // 03 — live your own story: photo pose behind the player at a downtown corner
  await teleport(page, -9, -9);
  await sleep(1500);
  {
    const p = await page.evaluate(() => window.__BLOCKSIDE_DEBUG__.getPosition());
    await pose(page, [p[0] + 6, p[1] + 2.0, p[2] + 6, p[0] - 10, p[1] + 1.0, p[2] - 10]);
  }
  await sleep(900);
  await shoot(page, 'raw-03-story.png');

  // 05 — a living city: camera above the road column, intersection below
  await teleport(page, -4, 44);
  await waitPopulation(page, { peds: 6, cars: 3 });
  await pose(page, [2, 24, 34, 0, 0.5, -10]);
  await sleep(900);
  await shoot(page, 'raw-05-living-city.png');

  // 09 — open-world freedom: high panorama over beachfront + highway + skyline
  await setHour(page, 17.9);
  await teleport(page, 300, 240);
  await pose(page, [430, 88, 250, -60, 6, -80]);
  await sleep(900);
  await shoot(page, 'raw-09-freedom.png');

  // 01a — introduction: golden-hour panorama from over the ocean (dusk)
  await setHour(page, 18.0);
  await teleport(page, 320, 40);
  await pose(page, [395, 60, 130, -40, 10, -40]);
  await sleep(900);
  await shoot(page, 'raw-01-introduction.png');

  // 01b — introduction alternate: dawn light over the city
  await setHour(page, 6.4);
  await sleep(900);
  await shoot(page, 'raw-01b-dawn.png');

  // 10 — the future: hero shot, sunset sky + city lights igniting
  await setHour(page, 18.3);
  await pose(page, [396, 54, -130, -80, 16, 60]);
  await sleep(900);
  await shoot(page, 'raw-10-future.png');

  // 08 — what's coming next: night boulevard, coupe 3/4 in frame, neon district
  await setHour(page, 21.4);
  await teleport(page, 320, 84);
  await sleep(1000);
  await pose(page, [326, 2.1, 38, 321.5, 0.9, 45.5]);
  await sleep(900);
  await shoot(page, 'raw-08-next.png');

  // 06a/06b — golden hour and night along the beachfront (identical pose, blended later)
  await pose(page, [334, 42, -170, 310, 14, 200]);
  await setHour(page, 17.6);
  await sleep(900);
  await shoot(page, 'raw-06a-morning.png');
  await setHour(page, 21.8);
  await sleep(900);
  await shoot(page, 'raw-06b-night.png');

  // 04b — parked VESPER GT beauty shot on the coastal boulevard at sunset
  await setHour(page, 18.0);
  await teleport(page, 320, 84);
  await sleep(1200);
  await pose(page, [316.5, 1.6, 39.0, 323.2, 1.0, 44.6]);
  await sleep(900);
  await shoot(page, 'raw-04-wheel-parked.png');

  // 04a — driving shot: follow camera while the coupe cruises the boulevard
  await page.evaluate(() => window.__BLOCKSIDE_DEBUG__.debugPhotoMode(false));
  await setHour(page, 18.0);
  await teleport(page, 323, 44);
  await sleep(1000);
  await page.keyboard.press('e'); // enter vehicle
  await page.waitForFunction(
    () => window.__BLOCKSIDE_DEBUG__.getVehicleState().driving === true,
    undefined,
    { timeout: 20000 },
  );
  await page.keyboard.down('w');
  await page.waitForFunction(
    () => window.__BLOCKSIDE_DEBUG__.getVehicleState().speedKmh > 15,
    undefined,
    { timeout: 30000 },
  );
  await sleep(700);
  await shoot(page, 'raw-04-wheel-driving.png');
  await page.keyboard.up('w');
  await page.keyboard.press('s');
  await sleep(1200);
  await page.keyboard.up('s');
  await page.keyboard.press('e'); // exit vehicle
  await sleep(1200);
}

/* ------------------------------------------------------------------ */
/* Group B — rain: neon district at night, wet streets                 */
/* ------------------------------------------------------------------ */

async function groupRain(page) {
  // 07 — dynamic weather: rainy neon-district street at night
  await waitWeather(page, 'rain');
  await waitWetness(page, 0.55);
  await setHour(page, 21.8);
  await teleport(page, 0, 160);
  await sleep(2500);
  await waitPopulation(page, { peds: 3, cars: 2, timeout: 45000 });
  await pose(page, [1.5, 1.7, 208, -6, 5, 140]);
  await sleep(900);
  await hideHud(page);
  await shoot(page, 'raw-07-rain.png');
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

const GROUPS = {
  sunny: groupSunny,
  rain: groupRain,
};

const manifest = {
  base: BASE,
  quality: QUALITY,
  viewport: { width: 1920, height: 1080 },
  captures: [],
  errors: [],
};

const browser = await chromium.launch();
try {
  for (const [name, fn] of Object.entries(GROUPS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    page.on('pageerror', (e) => {
      const msg = `[${name}] pageerror: ${e.message}`;
      console.error(msg);
      manifest.errors.push(msg);
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('AudioContext')) {
        const msg = `[${name}] console: ${m.text()}`;
        console.error(msg);
        manifest.errors.push(msg);
      }
    });
    try {
      await boot(page, { weather: name });
      await fn(page);
    } catch (err) {
      const msg = `[${name}] ${err && err.message ? err.message : String(err)}`;
      console.error('SHOT GROUP FAILED:', msg);
      manifest.errors.push(msg);
    } finally {
      await page.close().catch(() => {});
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.join(OUT, 'capture-manifest.json'),
  JSON.stringify(manifest, null, 2),
);
console.log('done. captures in', OUT);
if (manifest.errors.length) process.exitCode = 1;


