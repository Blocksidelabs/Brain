import { describe, expect, it } from 'vitest';
import { generateCity } from '../src/game/city/CityGenerator';
import {
  VEHICLE_SPAWNS,
  VEHICLE_SPECS,
  computeDrivetrain,
  rpmNorm,
  validateSpawn,
} from '../src/game/vehicles/vehicleTypes';

describe('vehicle specs', () => {
  it('defines all seven original vehicles with sane physics values', () => {
    expect(Object.keys(VEHICLE_SPECS).sort()).toEqual(
      ['coupe', 'moto', 'sedan', 'supercar', 'suv', 'taxi', 'van'].sort(),
    );
    for (const spec of Object.values(VEHICLE_SPECS)) {
      expect(spec.mass).toBeGreaterThan(spec.kind === 'moto' ? 250 : 800);
      // Motorcycles are deliberately tuned weaker than cars (class-aware floor).
      expect(spec.engineForce).toBeGreaterThan(spec.kind === 'moto' ? 2000 : 6000);
      expect(spec.brakeForce).toBeGreaterThan(spec.engineForce * 0.5);
      expect(spec.maxSpeed).toBeGreaterThan(20);
      expect(spec.suspension.stiffness).toBeGreaterThan(20000);
      expect(spec.suspension.rest).toBeGreaterThan(0.2);
      expect(spec.wheelRadius).toBeGreaterThan(0.2);
    }
  });

  it('gives the three vehicles distinct handling characteristics', () => {
    expect(VEHICLE_SPECS.supercar.maxSpeed).toBeGreaterThan(VEHICLE_SPECS.coupe.maxSpeed);
    expect(VEHICLE_SPECS.supercar.engineForce).toBeGreaterThan(VEHICLE_SPECS.coupe.engineForce);
    expect(VEHICLE_SPECS.suv.mass).toBeGreaterThan(VEHICLE_SPECS.coupe.mass);
    expect(VEHICLE_SPECS.suv.wheelRadius).toBeGreaterThan(VEHICLE_SPECS.coupe.wheelRadius);
  });
});

describe('computeDrivetrain (derived from real speed)', () => {
  it('shows N at standstill with idle rpm', () => {
    const d = computeDrivetrain(0, 0, false);
    expect(d.gear).toBe('N');
    expect(d.rpm).toBeCloseTo(800);
  });

  it('shows R while reversing', () => {
    expect(computeDrivetrain(12, 0, true).gear).toBe('R');
  });

  it('shifts gears 1..5 with rising speed', () => {
    expect(computeDrivetrain(20, 0.5, false).gear).toBe('1');
    expect(computeDrivetrain(50, 0.5, false).gear).toBe('2');
    expect(computeDrivetrain(95, 0.5, false).gear).toBe('3');
    expect(computeDrivetrain(140, 0.5, false).gear).toBe('4');
    expect(computeDrivetrain(200, 0.5, false).gear).toBe('5');
  });

  it('keeps rpm inside the gauge range', () => {
    for (let s = 0; s <= 220; s += 10) {
      const { rpm } = computeDrivetrain(s, 1, false);
      expect(rpm).toBeGreaterThanOrEqual(800);
      expect(rpm).toBeLessThanOrEqual(7200);
      expect(rpmNorm(rpm)).toBeGreaterThanOrEqual(0);
      expect(rpmNorm(rpm)).toBeLessThanOrEqual(1);
    }
  });
});

describe('vehicle spawn placement', () => {
  const city = generateCity(1337);

  it('places every spawn clear of building footprints', () => {
    for (const sp of VEHICLE_SPAWNS) {
      expect(validateSpawn(city, sp.x, sp.z)).toBe(true);
    }
  });

  it('keeps parked vehicles from overlapping each other', () => {
    for (let i = 0; i < VEHICLE_SPAWNS.length; i++) {
      for (let j = i + 1; j < VEHICLE_SPAWNS.length; j++) {
        const a = VEHICLE_SPAWNS[i];
        const b = VEHICLE_SPAWNS[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(8);
      }
    }
  });

  it('rejects points inside buildings', () => {
    const b = city.buildings[0];
    expect(validateSpawn(city, b.x, b.z)).toBe(false);
  });
});
