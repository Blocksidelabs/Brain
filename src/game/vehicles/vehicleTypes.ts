import type { CityData } from '../city/CityGenerator';

export type VehicleKind =
  | 'coupe'
  | 'supercar'
  | 'sedan'
  | 'suv'
  | 'taxi'
  | 'van'
  | 'moto';

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
    suspension: { rest: 0.28, stiffness: 65000, damping: 4200, maxForce: 28000 },
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
    suspension: { rest: 0.24, stiffness: 75000, damping: 4800, maxForce: 32000 },
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
    suspension: { rest: 0.3, stiffness: 62000, damping: 4200, maxForce: 30000 }, // SUV Tuned
    drive: 'rear',
    eye: { x: -0.42, y: 1.32, z: 0.1 },
  },
  sedan: {
    kind: 'sedan',
    name: 'MERIDIAN',
    tagline: 'BLOCKSIDE SEDAN',
    color: 0xb8bcc8,
    accentColor: 0x2f6db8,
    neonUnderglow: false,
    mass: 1420,
    engineForce: 7200,
    brakeForce: 10500,
    reverseForce: 4200,
    maxSpeed: 48,
    reverseMaxSpeed: 11,
    grip: 1.0,
    steerMax: 0.52,
    wheelRadius: 0.33,
    wheelWidth: 0.26,
    bodyHalf: { x: 0.92, y: 0.36, z: 2.25 },
    colliderLift: 0.44,
    wheelBaseZ: 1.45,
    trackX: 0.82,
    suspension: { rest: 0.3, stiffness: 62000, damping: 4200, maxForce: 30000 }, // Sedan Tuned
    drive: 'rear',
    eye: { x: -0.38, y: 1.1, z: 0.2 },
  },
  taxi: {
    kind: 'taxi',
    name: 'CITY CAB',
    tagline: 'BLOCKSIDE TAXI',
    color: 0xf1b428,
    accentColor: 0x10121a,
    neonUnderglow: false,
    mass: 1420,
    engineForce: 7000,
    brakeForce: 10000,
    reverseForce: 4200,
    maxSpeed: 46,
    reverseMaxSpeed: 11,
    grip: 1.0,
    steerMax: 0.52,
    wheelRadius: 0.33,
    wheelWidth: 0.26,
    bodyHalf: { x: 0.92, y: 0.36, z: 2.25 },
    colliderLift: 0.44,
    wheelBaseZ: 1.45,
    trackX: 0.82,
    suspension: { rest: 0.3, stiffness: 62000, damping: 4200, maxForce: 30000 }, // Taxi Tuned
    drive: 'rear',
    eye: { x: -0.38, y: 1.1, z: 0.2 },
  },
  van: {
    kind: 'van',
    name: 'HAULER',
    tagline: 'BLOCKSIDE DELIVERY VAN',
    color: 0xd8d4cc,
    accentColor: 0xd8582a,
    neonUnderglow: false,
    mass: 1900,
    engineForce: 7800,
    brakeForce: 9500,
    reverseForce: 4400,
    maxSpeed: 38,
    reverseMaxSpeed: 10,
    grip: 0.9,
    steerMax: 0.5,
    wheelRadius: 0.38,
    wheelWidth: 0.3,
    bodyHalf: { x: 1.02, y: 0.62, z: 2.5 },
    colliderLift: 0.7,
    wheelBaseZ: 1.6,
    trackX: 0.9,
    suspension: { rest: 0.45, stiffness: 65000, damping: 4500, maxForce: 34000 }, // Van Tuned
    drive: 'rear',
    eye: { x: -0.45, y: 1.5, z: 0.3 },
  },
  moto: {
    kind: 'moto',
    name: 'STREET FOX',
    tagline: 'BLOCKSIDE MOTORCYCLE',
    color: 0xc4342c,
    accentColor: 0xffd23c,
    neonUnderglow: false,
    mass: 320,
    engineForce: 2600,
    brakeForce: 4200,
    reverseForce: 1600,
    maxSpeed: 55,
    reverseMaxSpeed: 9,
    grip: 1.15,
    steerMax: 0.6,
    wheelRadius: 0.31,
    wheelWidth: 0.12,
    bodyHalf: { x: 0.3, y: 0.3, z: 1.05 },
    colliderLift: 0.42,
    wheelBaseZ: 0.72,
    trackX: 0.05,
    suspension: { rest: 0.3, stiffness: 55000, damping: 3000, maxForce: 18000 }, // Moto Tuned
    drive: 'rear',
    eye: { x: 0, y: 1.18, z: 0.1 },
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
  { kind: 'taxi', x: 4.5, z: 76, yaw: Math.PI }, // downtown cab rank
  { kind: 'sedan', x: 84.5, z: -235.5, yaw: Math.PI / 2 }, // residential street
  { kind: 'van', x: -235.5, z: -60, yaw: 0 }, // industrial loading street
  { kind: 'moto', x: 325.5, z: 120, yaw: 0 }, // beachfront boulevard
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
