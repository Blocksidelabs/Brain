# BLOCKSIDE

### THE CITY IS YOURS.

BLOCKSIDE is an original, browser-based 3D open-world sandbox inspired by the
atmosphere of retro Miami: 1980s neon, underground street culture, luxury
machines and nightlife on a beachfront metropolis. It is its own world — no
copyrighted maps, characters, logos or assets are used anywhere.

**Current status: Phases 1–5 complete.** A single-player foundation with a
detailed procedurally-built neon city, a full day/night cycle, walking
pedestrians with real sidewalk navigation, AI traffic that obeys lanes and
traffic lights, a complete driving system with seven original vehicles, and a
modular mission system with objectives, timers, and rewards.


---

## Technology stack

| Layer      | Choice                                        |
| ---------- | --------------------------------------------- |
| UI         | React 18 + TypeScript                         |
| Build      | Vite 5                                        |
| 3D engine  | Three.js r170                                 |
| Physics    | Rapier (`@dimforge/rapier3d-compat`)          |
| Audio      | WebAudio (procedural synthwave — no assets)   |
| Unit tests | Vitest                                        |
| E2E smoke  | Playwright (Chromium)                         |
| Lint       | ESLint 9 (flat config, typescript-eslint)     |

The backend (Node + Colyseus + PostgreSQL/Prisma) is planned for Phase 6+ and
is intentionally **not** stubbed out in this build — no fake implementations.

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173
```

Production:

```bash
npm run build     # tsc --noEmit + vite build → dist/
npm run preview   # serve dist/ at http://localhost:4173
```

## Scripts

| Script            | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Vite dev server with HMR                     |
| `npm run build`   | Type-check + production build                |
| `npm run preview` | Serve the production build                   |
| `npm run typecheck` | TypeScript, no emit                        |
| `npm run lint`    | ESLint over the repo                         |
| `npm test`        | Vitest unit tests (pure engine/game logic)   |
| `npm run e2e`     | Playwright smoke test (needs `npx playwright install chromium` once, plus a prior `npm run build`) |

## Controls

See [`docs/CONTROLS.md`](docs/CONTROLS.md). Short version: **WASD** move,
**Shift** sprint, **Space** jump, **Ctrl/C** crouch, **V** camera toggle,
**Esc** pause, mouse to look (click the viewport to capture the mouse).

## Project layout

```
src/
  config/       gameConfig.ts — world/player/camera tunables
  engine/       GameManager, PhysicsManager, InputManager, CameraManager,
                CharacterController, AudioManager, quality presets, math
  game/         WorldManager (sky/day-night), BlocksideGame (composition root),
                minimap, city/ (CityGenerator → zones, CityBuilder, textures,
                ground plan painter)
  state/        tiny reactive store + minimap canvas bridge
  ui/           React: MainMenu, HUD, Minimap, PauseMenu, Settings, Controls
tests/          Vitest unit tests
e2e/            Playwright smoke test
docs/           ARCHITECTURE / ROADMAP / CONTROLS / DATABASE
```

## Environment

Phase 1 needs **no** environment variables. See `.env.example` for the
placeholder names reserved for later phases (database, API, optional Solana).
Never commit real secrets.

## Roadmap

Phase-by-phase status lives in [`docs/ROADMAP.md`](docs/ROADMAP.md).
Multiplayer, economy and blockchain phases are explicitly downstream of a
solid single-player core.
