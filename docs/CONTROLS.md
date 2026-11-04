# CONTROLS

## On-foot (Phase 1)

| Input            | Action                                        |
| ---------------- | --------------------------------------------- |
| `W` `A` `S` `D`  | Move (camera-relative)                        |
| `SHIFT`          | Sprint                                        |
| `SPACE`          | Jump (with coyote time + input buffering)     |
| `CTRL` or `C`    | Crouch (slower movement, lowered pose/camera) |
| `V`              | Toggle third-person ⇄ first-person camera     |
| Mouse            | Look (click the viewport to capture the mouse)|
| Mouse wheel      | Camera distance (third person only)           |
| `ESC`            | Pause menu / release the mouse                |
| `E`              | Interact — reserved (vehicles arrive Phase 3) |

## Notes

- Movement always stays camera-relative; switching cameras never moves or
  resets the player.
- Third-person camera avoids clipping by raycasting against the city.
- First person hides the character model and seats the camera at eye height.
- Settings (gear in pause menu or main menu): quality Low/Medium/High,
  master volume, synthwave radio on/off, mouse sensitivity, invert look Y.
  Settings persist in `localStorage`.
- If your OS requests reduced motion, camera bob and UI animations are
  disabled automatically.

## Driving (Phase 3)

Walk up to any parked vehicle — an interaction prompt appears — then:

| Input            | Action                                        |
| ---------------- | --------------------------------------------- |
| `E`              | Enter the nearest vehicle / exit (slow down first — under ~22 km/h) |
| `W`              | Accelerate                                    |
| `S`              | Brake; keeps braking to a stop, then reverses |
| `A` / `D`        | Steer left / right (range tightens with speed)|
| `SPACE`          | Handbrake (locks the rear axle → slides)      |
| `V`              | Third-person chase ⇄ cockpit camera           |
| Mouse wheel      | Chase camera distance                         |
| `SHIFT`          | Nitro — **foundation only**, disabled until the upgrade phase |

The driving HUD shows real speed (from vehicle velocity), gear, RPM, fuel,
vehicle condition, handbrake state and the nitro slot. Crashing reduces
condition; engine efficiency drops with damage. An overturned vehicle
auto-rights itself after a couple of seconds.

## Planned (later phases)

- Full controller support and key rebinding — Phase 2 polish.
- Mission markers on the minimap — Phase 5.
