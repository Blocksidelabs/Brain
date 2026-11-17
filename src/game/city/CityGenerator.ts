import { CITY } from '../../config/gameConfig';
import { mulberry32, rngInt, rngPick, rngRange, type Rng } from '../../engine/mathUtils';
import { blockCenter, blockZone, type ZoneId } from './zones';

export interface SignSpecOnBuilding {
  /** 0=north(-z) 1=east(+x) 2=south(+z) 3=west(-x) */
  face: 0 | 1 | 2 | 3;
  tex: number;
  y: number;
  w: number;
  h: number;
}

export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  zone: ZoneId;
  tint: string;
  sign?: SignSpecOnBuilding;
}

export interface RoofPropSpec {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface LampSpec {
  x: number;
  z: number;
  /** rotation (radians) aligning the lamp arm's local +X with the road */
  rotY: number;
}

export interface TrafficLightSpec {
  x: number;
  z: number;
}

export interface PalmSpec {
  x: number;
  z: number;
  h: number;
  tilt: number;
  rot: number;
}

export interface CityData {
  buildings: BuildingSpec[];
  roofProps: RoofPropSpec[];
  lamps: LampSpec[];
  trafficLights: TrafficLightSpec[];
  palms: PalmSpec[];
  plaza: { x: number; z: number };
  park: { x: number; z: number };
  gasStations: { x: number; z: number }[];
  spawn: { x: number; z: number; yaw: number };
}

export const SIGN_TEXTURE_COUNT = 12;

const TINTS: Record<ZoneId, string[]> = {
  downtown: ['#3b4668', '#46356b', '#2f3b5c', '#514064', '#3a4f77'],
  beachfront: ['#d8cfc0', '#cfe3e8', '#e8d9c4', '#c9d8e8', '#e3d3d8'],
  residential: ['#8c6f5a', '#a58a6f', '#7d8a93', '#97705e', '#8f9a85'],
  nightlife: ['#2a1e3f', '#35204d', '#241b38', '#3c1f45'],
  industrial: ['#5a5f66', '#6a6157', '#57636a', '#665f52'],
  highway: ['#5a5f66'],
};

export const PLAZA_LOT = { bx: 4, bz: 3 };
export const PARK_LOT = { bx: 2, bz: 1 };
export const GAS_LOT = { bx: 5, bz: 6 };

function pickTint(rng: Rng, zone: ZoneId): string {
  return rngPick(rng, TINTS[zone]);
}

/** Attach a neon sign on the facade closest to a road. */
function attachSign(rng: Rng, b: BuildingSpec, cx: number, cz: number, big: boolean): void {
  const half = CITY.lot / 2;
  const dNorth = b.z - b.d / 2 - (cz - half);
  const dEast = cx + half - (b.x + b.w / 2);
  const dSouth = cz + half - (b.z + b.d / 2);
  const dWest = b.x - b.w / 2 - (cx - half);
  const m = Math.min(dNorth, dEast, dSouth, dWest);
  const face = (m === dNorth ? 0 : m === dEast ? 1 : m === dSouth ? 2 : 3) as 0 | 1 | 2 | 3;
  const w = big ? rngRange(rng, 7, 11) : rngRange(rng, 5, 8);
  b.sign = {
    face,
    tex: rngInt(rng, 0, SIGN_TEXTURE_COUNT - 1),
    y: Math.min(b.h - 2.5, 5 + rng() * 13),
    w,
    h: w * 0.42,
  };
}

function fillLot(
  rng: Rng,
  bx: number,
  bz: number,
  out: BuildingSpec[],
  roofProps: RoofPropSpec[],
  palms: PalmSpec[],
): void {
  const zone = blockZone(bx, bz);
  const cx = blockCenter(bx);
  const cz = blockCenter(bz);
  const j = () => rngRange(rng, -3, 3);

  const push = (x: number, z: number, w: number, d: number, h: number, signBig: boolean): BuildingSpec => {
    const b: BuildingSpec = { x, z, w, d, h, zone, tint: pickTint(rng, zone) };
    if (
      signBig ||
      (zone === 'residential' && rng() < 0.12) ||
      (zone === 'industrial' && rng() < 0.18)
    ) {
      attachSign(rng, b, cx, cz, signBig);
    }
    out.push(b);
    return b;
  };

  if (zone === 'downtown') {
    const slots: Array<readonly [number, number]> = [
      [-14, -14],
      [14, 14],
    ];
    for (const [ox, oz] of slots) {
      const w = rngRange(rng, 16, 22);
      const d = rngRange(rng, 16, 22);
      const h = ox < 0 ? rngRange(rng, 55, 110) : rngRange(rng, 40, 80);
      const b = push(cx + ox + j(), cz + oz + j(), w, d, h, true);
      roofProps.push({ x: b.x, y: h, z: b.z, w: rngRange(rng, 2, 4), d: rngRange(rng, 2, 4), h: rngRange(rng, 1.5, 3.5) });
      if (rng() < 0.7) {
        roofProps.push({ x: b.x + rngRange(rng, -6, 6), y: h, z: b.z + rngRange(rng, -6, 6), w: 3, d: 2.4, h: rngRange(rng, 1, 2.5) });
      }
    }
  } else if (zone === 'nightlife') {
    const slots: Array<[number, number]> = [
      [-14, -14],
      [14, -14],
      [-14, 14],
      [14, 14],
    ];
    for (let i = slots.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      [slots[i], slots[k]] = [slots[k], slots[i]];
    }
    const n = rngInt(rng, 2, 3);
    for (let s = 0; s < n; s++) {
      const [ox, oz] = slots[s];
      push(cx + ox + j(), cz + oz + j(), rngRange(rng, 16, 22), rngRange(rng, 14, 20), rngRange(rng, 12, 28), true);
    }
  } else if (zone === 'beachfront') {
    for (const [ox, oz] of [
      [-14, 0],
      [14, 0],
    ] as const) {
      const b = push(cx + ox + j(), cz + oz + j(), rngRange(rng, 16, 20), rngRange(rng, 14, 18), rngRange(rng, 22, 55), true);
      if (rng() < 0.6) {
        roofProps.push({ x: b.x, y: b.h, z: b.z, w: 2.6, d: 2.2, h: rngRange(rng, 1.2, 2.6) });
      }
    }
    if (rng() < 0.55) palms.push({ x: cx + 24, z: cz + 24, h: rngRange(rng, 4.5, 7), tilt: rngRange(rng, -0.06, 0.06), rot: rng() * Math.PI * 2 });
  } else if (zone === 'residential') {
    for (const [ox, oz] of [
      [-14, -14],
      [14, -14],
      [-14, 14],
      [14, 14],
    ] as const) {
      push(cx + ox + j(), cz + oz + j(), rngRange(rng, 8, 12), rngRange(rng, 8, 12), rngRange(rng, 5, 9), false);
    }
    if (rng() < 0.12) palms.push({ x: cx - 24, z: cz - 24, h: rngRange(rng, 4, 6.5), tilt: rngRange(rng, -0.05, 0.05), rot: rng() * Math.PI * 2 });
  } else if (zone === 'industrial') {
    if (rng() < 0.55) {
      for (const ox of [-14, 14]) {
        push(cx + ox + j(), cz + j(), rngRange(rng, 18, 22), rngRange(rng, 28, 40), rngRange(rng, 8, 13), false);
      }
    } else {
      push(cx + j(), cz + j(), rngRange(rng, 36, 48), rngRange(rng, 28, 40), rngRange(rng, 8, 14), false);
    }
  }
}

export function generateCity(seed = 1337): CityData {
  const rng = mulberry32(seed);
  const buildings: BuildingSpec[] = [];
  const roofProps: RoofPropSpec[] = [];
  const palms: PalmSpec[] = [];
  const lamps: LampSpec[] = [];
  const trafficLights: TrafficLightSpec[] = [];

  for (let bz = 0; bz < CITY.grid; bz++) {
    for (let bx = 0; bx < CITY.grid; bx++) {
      if (bx === PLAZA_LOT.bx && bz === PLAZA_LOT.bz) continue;
      if (bx === PARK_LOT.bx && bz === PARK_LOT.bz) continue;
      if (bx === GAS_LOT.bx && bz === GAS_LOT.bz) continue;
      fillLot(rng, bx, bz, buildings, roofProps, palms);
    }
  }

  // Park grove + plaza dressing
  const parkCx = blockCenter(PARK_LOT.bx);
  const parkCz = blockCenter(PARK_LOT.bz);
  for (let i = 0; i < 6; i++) {
    palms.push({
      x: parkCx + rngRange(rng, -22, 22),
      z: parkCz + rngRange(rng, -22, 22),
      h: rngRange(rng, 4.5, 7.5),
      tilt: rngRange(rng, -0.07, 0.07),
      rot: rng() * Math.PI * 2,
    });
  }
  const plazaCx = blockCenter(PLAZA_LOT.bx);
  const plazaCz = blockCenter(PLAZA_LOT.bz);
  for (const [ox, oz] of [
    [-24, -24],
    [24, -24],
    [-24, 24],
    [24, 24],
  ] as const) {
    palms.push({ x: plazaCx + ox, z: plazaCz + oz, h: rngRange(rng, 5, 7), tilt: 0, rot: rng() * Math.PI * 2 });
  }

  // Beachfront palm row along the boardwalk
  for (let z = -308; z <= 308; z += 13) {
    palms.push({
      x: 333 + rng() * 14,
      z: z + rngRange(rng, -3, 3),
      h: rngRange(rng, 4, 7.5),
      tilt: rngRange(rng, -0.06, 0.06),
      rot: rng() * Math.PI * 2,
    });
  }

  // Street lamps near every intersection corner (alternating corners)
  const ring0 = -(CITY.grid * CITY.pitch) / 2;
  for (let kx = 0; kx <= CITY.grid; kx++) {
    for (let kz = 0; kz <= CITY.grid; kz++) {
      const ix = ring0 + kx * CITY.pitch;
      const iz = ring0 + kz * CITY.pitch;
      const offA = ((kx + kz) % 2 === 0 ? 1 : -1) * 10.5;
      let offB = ((kx * 3 + kz) % 2 === 0 ? 1 : -1) * 10.5;
      if (kz === CITY.grid) offB = 14.5; // keep clear of the wide highway shoulders
      const x = ix + offA;
      const z = iz + offB;
      const dx = ix - x;
      const dz = iz - z;
      const len = Math.hypot(dx, dz) || 1;
      lamps.push({ x, z, rotY: Math.atan2(-dz / len, dx / len) });
    }
  }

  // Traffic lights on a deterministic subset of interior intersections
  for (let kx = 1; kx < CITY.grid; kx++) {
    for (let kz = 1; kz < CITY.grid; kz++) {
      if ((kx * 5 + kz * 3) % 4 === 0) {
        trafficLights.push({ x: ring0 + kx * CITY.pitch + 9.2, z: ring0 + kz * CITY.pitch + 9.2 });
      }
    }
  }

  return {
    buildings,
    roofProps,
    lamps,
    trafficLights,
    palms,
    plaza: { x: plazaCx, z: plazaCz },
    park: { x: parkCx, z: parkCz },
    gasStations: [{ x: blockCenter(GAS_LOT.bx), z: blockCenter(GAS_LOT.bz) }],
    spawn: { x: 314, z: 24, yaw: Math.PI / 2 },
  };
}

