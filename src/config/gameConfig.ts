/** Shared tunables for the Phase 1 city, player and camera. */

export const CITY = {
  grid: 8,
  pitch: 80,
  lot: 64,
  road: 16,
  coastalRoadWidth: 20,
  highwayWidth: 26,
  sidewalkHeight: 0.15,
  /** east ring road center x (coastal boulevard) */
  coastalX: 320,
  /** south ring road center z (Sunset Highway) */
  highwayZ: 320,
  /** solid invisible wall plane (players blocked here) */
  bound: 340,
  /** painted ground plane half-size in world meters */
  planeHalf: 360,
  /** where sand ends and ocean begins (x) */
  waterlineX: 356,
} as const;

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 7.4,
  crouchSpeed: 2.1,
  accelGround: 14,
  accelAir: 3.2,
  jumpSpeed: 8.0,
  gravity: 22,
  eyeHeight: 1.62,
  radius: 0.35,
  halfHeight: 0.55,
} as const;

export const CAMERA = {
  fov: 66,
  near: 0.1,
  farHigh: 900,
  farLow: 480,
  thirdDist: 5.4,
  minDist: 1.1,
  maxDist: 8.5,
  height: 1.55,
  sensDefault: 0.0023,
} as const;

export const DAYNIGHT = {
  startHour: 18.9,
  cycleSeconds: 600,
} as const;

export const GAME_VERSION = '0.1.0-phase1';
