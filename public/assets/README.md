# BLOCKSIDE asset pipeline

Runtime-loaded GLB/GLTF overrides, organised by category. Anything placed
here with the expected name replaces the built-in procedural model at
startup; missing files fall back silently (the game never crashes on a
missing asset).

| Folder        | Expected override names                              |
| ------------- | ---------------------------------------------------- |
| `characters/` | `player.glb` (player character)                      |
| `vehicles/`   | `coupe.glb`, `supercar.glb`, `sedan.glb`, `suv.glb`, `taxi.glb`, `van.glb`, `moto.glb` |
| `buildings/`  | `tower.glb`, `office.glb`, `hotel.glb`, … (per archetype) |
| `environment/`| e.g. `lifeguard.glb`                                 |
| `props/`      | `bench.glb`, `bin.glb`, …                            |
| `textures/`   | optional texture overrides                           |
| `audio/`      | optional audio (not yet wired)                       |

Rules:
- Units are metres, +Y up, forward = −Z (same as the engine).
- Only original or properly licensed assets. No Rockstar/GTA content.
- Models should be static meshes (skinned animation support is planned).
- The GLB is auto-scaled so its bounding-box length matches the vehicle
  spec, so export at any convenient scale.
