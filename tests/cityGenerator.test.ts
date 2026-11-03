import { describe, expect, it } from 'vitest';
import { generateCity } from '../src/game/city/CityGenerator';

function lotIndex(coord: number): number {
  return Math.round((coord + 320 - 40) / 80);
}

describe('generateCity', () => {
  const city = generateCity(1337);

  it('is deterministic for a given seed', () => {
    const again = generateCity(1337);
    expect(JSON.stringify(again)).toBe(JSON.stringify(city));
  });

  it('produces a populated city', () => {
    expect(city.buildings.length).toBeGreaterThan(80);
    expect(city.lamps.length).toBeGreaterThan(60);
    expect(city.palms.length).toBeGreaterThan(30);
    expect(city.trafficLights.length).toBeGreaterThan(0);
    expect(city.roofProps.length).toBeGreaterThan(0);
  });

  it('keeps every building on land inside the walls', () => {
    for (const b of city.buildings) {
      expect(b.h).toBeGreaterThan(0);
      expect(b.x - b.w / 2).toBeGreaterThan(-330);
      expect(b.x + b.w / 2).toBeLessThan(330);
      expect(b.z - b.d / 2).toBeGreaterThan(-330);
      expect(b.z + b.d / 2).toBeLessThan(330);
    }
  });

  it('has no overlapping buildings on the same lot', () => {
    const byLot = new Map<string, typeof city.buildings>();
    for (const b of city.buildings) {
      const key = `${lotIndex(b.x)}:${lotIndex(b.z)}`;
      const list = byLot.get(key) ?? [];
      list.push(b);
      byLot.set(key, list);
    }
    for (const list of byLot.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const c = list[j];
          const overlapX = Math.abs(a.x - c.x) < (a.w + c.w) / 2;
          const overlapZ = Math.abs(a.z - c.z) < (a.d + c.d) / 2;
          expect(overlapX && overlapZ).toBe(false);
        }
      }
    }
  });

  it('spawns on the coastal boulevard facing downtown', () => {
    expect(city.spawn.x).toBeGreaterThan(300);
    expect(city.spawn.x).toBeLessThan(330);
    expect(city.spawn.yaw).toBeCloseTo(Math.PI / 2);
  });
});
