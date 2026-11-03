# ROADMAP

Phases follow the project brief strictly: no phase starts before the previous
one passes verification.

| Phase | Scope                                                   | Status         |
| ----- | ------------------------------------------------------- | -------------- |
| 0     | Repository audit & architecture setup                    | ✅ Complete     |
| 1     | Playable 3D city (world, character, cameras, HUD)        | ✅ Complete     |
| 2     | Character polish: camera collision hardening, rebinding  | 🔜 Next         |
| 3     | Vehicle system: driving physics, enter/exit, vehicle HUD | ⏳ Planned      |
| 4     | Environment life: pedestrian NPCs, traffic, activation   | ⏳ Planned      |
| 5     | Missions: objectives, markers, rewards, history          | ⏳ Planned      |
| 6     | Backend & database: Node/Colyseus, PostgreSQL + Prisma   | ⏳ Planned      |
| 7     | Multiplayer: rooms, sync, chat, profiles                 | ⏳ Planned      |
| 8     | Player economy & properties (server-authoritative)       | ⏳ Planned      |
| 9     | Solana integration (optional; never required to play)    | ⏳ Planned      |
| 10    | Optimization, security, public release                   | ⏳ Planned      |

## Phase 0 — done
- Audited workspace (shared scratch dir; no existing BLOCKSIDE project).
- Tooling verified: Node 22, npm 11, Git 2.55.
- Scaffolded Vite + React + TS, pinned stable deps (Three r170, Rapier 0.14).
- Git initialized with checkpoint commits.

## Phase 1 — done (verification results in the final build report)
- Original procedural city: 6 zones, plaza, park, beach + ocean, ring highway.
- Day/night cycle with dusk-tuned palette, stars, sun/moon.
- Neon identity: HDR sign/billboard materials + bloom, flicker accents.
- Character: spawn, camera-relative movement, sprint/jump/crouch, collision.
- Cameras: third/first person, collision-aware, wheel zoom, smooth switch.
- Menus/HUD: main menu, pause, settings (quality/volume/sens/invert-Y),
  controls screen, minimap, zone banners, clock, health/money, FPS.
- Procedural synthwave radio (original WebAudio composition).
- Tests: Vitest units (city determinism/layout, zones, math, store),
  Playwright boot smoke; production build verified.

## Known Phase 1 limitations (honest list)
- Crouch adjusts speed/pose/camera but the capsule height stays constant
  (nothing to crawl under yet).
- Traffic lights are visual only; traffic AI is Phase 4.
- Interaction prompt (`E`) infrastructure exists but nothing to interact with
  until vehicles (Phase 3).
- Health/money are real store state but have no gameplay drains/earnings yet.
