/** Small math helpers shared by engine systems. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential approach from a towards b. */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

/** Damped approach across the shortest arc between two angles (radians). */
export function dampAngle(a: number, b: number, lambda: number, dt: number): number {
  const twoPi = Math.PI * 2;
  let diff = (b - a) % twoPi;
  if (diff > Math.PI) diff -= twoPi;
  if (diff < -Math.PI) diff += twoPi;
  return a + diff * (1 - Math.exp(-lambda * dt));
}

export type Rng = () => number;

/** Deterministic 32-bit PRNG (mulberry32). Same seed => identical sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Inclusive integer in [min, max]. */
export function rngInt(rng: Rng, min: number, maxInclusive: number): number {
  return Math.min(maxInclusive, Math.floor(rngRange(rng, min, maxInclusive + 0.999)));
}

export function rngPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
}
