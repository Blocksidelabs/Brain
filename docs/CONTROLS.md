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

## Planned (later phases)

- Vehicles: `W/S` accelerate/brake-reverse, `A/D` steer, `SPACE` handbrake,
  `E` enter/exit, `V` camera — Phase 3.
- Full controller support and key rebinding — Phase 2/3 polish.
