import { describe, expect, it } from 'vitest';
import { clamp, damp, dampAngle, lerp, mulberry32, rngInt, rngPick, rngRange } from '../src/engine/mathUtils';

describe('mathUtils', () => {
  it('clamps values into range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-2, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerps linearly', () => {
    expect(lerp(0, 10, 0.5)).toBeCloseTo(5);
    expect(lerp(-4, 4, 0.25)).toBeCloseTo(-2);
  });

  it('damp converges towards the target', () => {
    let v = 0;
    for (let i = 0; i < 240; i++) v = damp(v, 10, 4, 1 / 60);
    expect(v).toBeGreaterThan(9.5);
    expect(v).toBeLessThanOrEqual(10);
  });

  it('dampAngle takes the shortest arc', () => {
    const a = -Math.PI + 0.1;
    const b = Math.PI - 0.1;
    const r = dampAngle(a, b, 1000, 0.5);
    // Step direction must be the short way (< π radians of travel),
    // even if the result itself lands just past the ±π wrap.
    let diff = (r - a) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    expect(Math.abs(diff)).toBeLessThanOrEqual(Math.PI);
    // Converged result is equivalent to the target angle modulo 2π.
    expect(r).toBeCloseTo(b - Math.PI * 2, 5);
  });

  it('mulberry32 is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(1);
  });

  it('rng helpers stay within bounds', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const v = rngRange(rng, -3, 5);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(5);
      const n = rngInt(rng, 0, 3);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(3);
      expect(rngPick(rng, [10, 20, 30])).toBeLessThanOrEqual(30);
      expect([10, 20, 30]).toContain(rngPick(rng, [10, 20, 30]));
    }
  });
});
