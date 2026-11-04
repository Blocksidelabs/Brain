import type { CityData } from '../city/CityGenerator';

export type VehicleKind = 'coupe' | 'supercar' | 'suv';

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  tagline: string;
  color: number;
  accentColor: number;
  neonUnderglow: boolean;
  /** physics */
  mass: number;
  engineForce: number; // N, total at driven wheels
  brakeForce: number; // N, total
  reverseForce: number; // N, total
  maxSpeed: number; // m/s
  reverseMaxSpeed: number; // m/s
  grip: number; // lateral friction multiplier
  steerMax: number; // radians at standstill
  wheelRadius: number;
  wheelWidth: number;
  bodyHalf: { x: number; y: number; z: number };
  colliderLift: number; // collider center above body origin (low COM)
  wheelBaseZ: number; // ± half distance between axles
  trackX: number; // ± half distance across wheels
  suspension: { rest: number; stiffness: number; damping: number; maxForce: number };
  drive: 'rear' | 'all';
  /** first-person cockpit anchor (local, relative to body origin) */
  eye: { x: number; y: number; z: number };
}

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  coupe: {
    kind: 'coupe',
    name: 'VESPER GT',
    tagline: 'BLOCKSIDE SPORTS COUPE',
    color: 0x7a2bd0,
    accentColor: 0xff2d95,
    neonUnderglow: true,
    mass: 1250,
    engineForce: 7600,
    brakeForce: 11000,
    reverseForce: 4200,
    maxSpeed: 53,
    reverseMaxSpeed: 12,
    grip: 1.08,
    steerMax: 0.58,
    wheelRadius: 0.34,
    wheelWidth: 0.28,
    bodyHalf: { x: 0.9, y: 0.34, z: 2.12 },
    colliderLift: 0.4,
    wheelBaseZ: 1.42,
    trackX: 0.8,
    suspension: { rest: 0.4, stiffness: 52000, damping: 3400, maxForce: 26000 },
    drive: 'rear',
    eye: { x: -0.38, y: 1.06, z: 0.12 },
  },
  supercar: {
    kind: 'supercar',
    name: 'AERO-9',
    tagline: 'BLOCKSIDE SUPERCAR',
    color: 0x232833,
    accentColor: 0x35e0ff,
    neonUnderglow: false,
    mass: 1180,
    engineForce: 10500,
    brakeForce: 12500,
    reverseForce: 4800,
    maxSpeed: 67,
    reverseMaxSpeed: 12,
    grip: 1.25,
    steerMax: 0.5,
    wheelRadius: 0.35,
    wheelWidth: 0.32,
    bodyHalf: { x: 0.96, y: 0.3, z: 2.2 },
    colliderLift: 0.36,
    wheelBaseZ: 1.5,
    trackX: 0.86,
    suspension: { rest: 0.34, stiffness: 62000, damping: 3600, maxForce: 30000 },
    drive: 'all',
    eye: { x: -0.4, y: 0.98, z: 0.02 },
  },
  suv: {
    kind: 'suv',
    name: 'TERRA-X',
    tagline: 'BLOCKSIDE SUV',
    color: 0x175a52,
    accentColor: 0xff7a3c,
    neonUnderglow: false,
    mass: 1750,
    engineForce: 8600,
    brakeForce: 10500,
    reverseForce: 4600,
    maxSpeed: 46,
    reverseMaxSpeed: 11,
    grip: 0.92,
    steerMax: 0.52,
    wheelRadius: 0.42,
    wheelWidth: 0.34,
    bodyHalf: { x: 1.0, y: 0.5, z: 2.3 },
    colliderLift: 0.56,
    wheelBaseZ: 1.55,
    trackX: 0.88,
    suspension: { rest: 0.52, stiffness: 58000, damping: 4000, maxForce: 34000 },
    drive: 'rear',
    eye: { x: -0.42, y: 1.32, z: 0.1 },
  },
};

export interface VehicleSpawnSpec {
  kind: VehicleKind;
  x: number;
  z: number;
  yaw: number;
}

/** Parked vehicles — all on road corridors, clear of building lots. */
export const VEHICLE_SPAWNS: VehicleSpawnSpec[] = [
  { kind: 'coupe', x: 325.5, z: 44, yaw: 0 }, // coastal boulevard, near player spawn
  { kind: 'supercar', x: 4.5, z: -22, yaw: 0 }, // downtown, beside the plaza block
  { kind: 'suv', x: 84.5, z: -160, yaw: Math.PI / 2 }, // residential street
  { kind: 'coupe', x: 325.5, z: -60, yaw: Math.PI }, // coastal boulevard, south
  { kind: 'suv', x: -235.5, z: 44, yaw: 0 }, // industrial docks road
];

/** True when (x, z) is clear of every building footprint (+margin). */
export function validateSpawn(data: CityData, x: number, z: number, margin = 1.0): boolean {
  for (const b of data.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) {
      return false;
    }
  }
  return true;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Drivetrain readout derived from ACTUAL speed — used by HUD + engine audio.
 * Gears 1..5 shift every 45 km/h; R while reversing; N below walking pace.
 */
export function computeDrivetrain(
  speedKmh: number,
  throttle: number,
  reversing: boolean,
): { gear: string; rpm: number } {
  if (reversing) {
    return { gear: 'R', rpm: 900 + clamp01(speedKmh / 60) * 4800 };
  }
  if (speedKmh < 1) {
    return { gear: 'N', rpm: 800 + Math.abs(throttle) * 2200 };
  }
  const gearIdx = Math.min(4, Math.floor(speedKmh / 45));
  const within = (speedKmh - gearIdx * 45) / 45;
  const rpm = 1100 + within * 5400 + Math.max(0, throttle) * 500;
  return { gear: String(gearIdx + 1), rpm: Math.min(7200, rpm) };
}

/** Normalized 0..1 rpm for bars and engine pitch. */
export function rpmNorm(rpm: number): number {
  return clamp01((rpm - 800) / 6400);
}
