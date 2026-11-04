# ARCHITECTURE

## Overview

BLOCKSIDE separates the **engine** (reusable systems) from the **game**
(city, player, rules) and the **UI** (React). The game loop lives entirely in
the engine layer; React never touches Three.js objects directly.

```
┌────────────────────────── React (src/ui) ──────────────────────────┐
│ MainMenu │ HUD/Minimap │ PauseMenu │ Settings │ Controls        │
└───────────────▲───────────────────────────────▲────────────────────┘
                │ store (useSyncExternalStore)   │ minimap canvas bridge
┌───────────────┴───────────────────────────────┴────────────────────┐
│ BlocksideGame (src/game) — composition root, implements GameSystems │
│  WorldManager (sky, fog, lights, day/night)  │  CharacterController │
│  city/: CityGenerator → CityBuilder + ground │  CameraManager       │
│  plan painter + procedural textures          │  AudioManager        │
├─────────────────────────────────────────────────────────────────────┤
│ GameManager (src/engine) — renderer, post stack (bloom), rAF loop,  │
│ resize, pause, quality application, dispose                          │
├─────────────────────────────────────────────────────────────────────┤
│ PhysicsManager — Rapier world, fixed 60 Hz stepping, raycasts        │
└─────────────────────────────────────────────────────────────────────┘
```

## Frame data flow

1. `GameManager.loop` computes a clamped `dt` and calls
   `BlocksideGame.update(dt, elapsed)`.
2. Input deltas are consumed (mouse look, wheel zoom, edge-triggered keys).
3. `PhysicsManager.step` advances the Rapier world in fixed 1/60 s substeps.
4. `CharacterController.update` converts input into a wish vector
   (camera-relative), accelerates velocities, integrates vertical motion and
   moves the kinematic body through Rapier's `KinematicCharacterController`
   (`computeColliderMovement` → corrected displacement → ground state).
5. `CameraManager.update` places the camera behind the look direction,
   raycasts against the physics world to avoid clipping through buildings,
   and blends distance for third⇄first-person transitions.
6. `WorldManager.update` advances the day/night clock and repaints sky, fog,
   sun/moon light, stars and all city emissive materials.
7. HUD data (zone, clock) is pushed through the store at 4 Hz; FPS at 2 Hz.
   The minimap draws directly into a canvas owned by React via a small
   registry, bypassing React state for per-frame data.

## Key decisions

**Data-driven procedural city.** `CityGenerator` is pure TypeScript with a
seeded PRNG (mulberry32) producing a `CityData` layout — buildings, neon
signs, lamps, traffic lights, palms, spawn. Determinism makes it unit-testable
and reproducible. `CityBuilder` turns that data into Three.js objects.

**One draw call for the whole ground plan.** Roads, lane markings,
crosswalks, sidewalks, parking stalls, plaza, park, sand and boardwalk are
painted once into a 4096² canvas and applied to a single plane
(`groundPlan.ts`). Canvas-space orientation uses `flipY = false` with a
matching v-axis mapping so the minimap, physics and visuals agree.

**Instancing everywhere.** Buildings are three height-bucketed
`InstancedMesh`es with per-instance colors and a shared window
diffuse/emissive texture pair. Neon signs, street lamps (pole/arm/head),
light pools, traffic lights, palms (trunks/fronds) and roof props are all
instanced. Total scene draw calls stay in the dozens, not thousands.

**Neon without light spam.** There are no per-sign point lights. Neon reads
through emissive/HDR colors + `UnrealBloomPass`; night ambience comes from a
hemisphere light, a moon-tinted directional light and additive light-pool
decals under lamps. This scales to a whole city on ordinary GPUs.

**Character physics.** A kinematic position-based rigid body + capsule
collider + Rapier character controller (slope limits, autostep, snap-to-ground)
gives real collision against every building and the boundary walls, with
game-feel niceties (coyote time, jump buffering) implemented on top.

**Quality levels.** `quality.ts` presets drive pixel ratio, shadow map size,
bloom, fog density and camera far plane; applied live from settings without a
rebuild. `prefers-reduced-motion` disables camera smoothing extras, character
bob and CSS animations.

**UI bridge.** A ~60-line store (`useSyncExternalStore`) is the only
React⇄engine channel for state; an event-bus style callback set (hooks) is
used for one-shot notifications (zone change, lock change, escape).

## Memory & lifecycle

`GameManager.dispose` cancels the loop, disposes the composer, renderer and
DOM canvas; `BlocksideGame.dispose` detaches input, closes audio, disposes
the world (all geometries/materials/textures) and frees the Rapier world.
Returning to the main menu fully tears the session down; starting a new game
rebuilds it — no leaked GPU resources between sessions.

## Multiplayer readiness (Phase 7+)

The engine/game split is deliberately server-friendly: `CityData` is a plain
serializable layout, and the composition root is the single place where
simulations advance. When Colyseus arrives, an authoritative server will own
state transitions (money, missions, vehicles) while clients send inputs —
the client-side architecture already isolates those concerns behind systems.

## Vehicles (Phase 3)

`src/game/vehicles/` — `VehicleManager` owns spawning, enter/exit, input
routing, HUD data and audio; `Vehicle` is one car (physics + visuals);
`vehicleTypes.ts` holds pure, unit-tested data; `vehicleModels.ts` builds
procedural models from cached templates (clone shares geometry/materials).

**Physics model.** Rapier's JS bindings expose no vehicle controller, so
each car is a classic raycast-suspension vehicle on a real dynamic rigid
body (CCD enabled, collider lifted for a low center of mass):

1. Four downward rays from chassis anchor points feed a spring/damper
   (`F = k·compression + c·compressionRate`, clamped), applied as impulses
   at the anchors — real suspension travel, weight transfer, body roll.
2. Per grounded wheel, tire forces are applied at the ground contact point:
   lateral slip is killed with a friction-capped impulse (load-scaled,
   reduced on the rear axle during handbrake → slides), longitudinal force
   carries engine (speed-falloff), reverse, brakes (direction-safe clamped)
   and rolling resistance.
3. Steering rotates the front wheel contact frames; steer range tightens
   with speed. Damage is a Δv-based foundation (crashes reduce condition and
   engine efficiency); an overturned car auto-rights itself.

Parked cars rely on Rapier sleeping: a settled car applies no forces and
casts no rays, so five parked vehicles are effectively free. Fuel drains
while throttling (engine cuts at empty — foundation). GLTF/GLB models can
later replace the procedural builders behind the same `VehicleModel`
interface without touching physics.
