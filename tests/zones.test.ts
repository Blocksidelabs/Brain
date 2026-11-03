import { describe, expect, it } from 'vitest';
import { CITY } from '../src/config/gameConfig';
import { ZONE_DEFS, blockCenter, blockZone, zoneAt } from '../src/game/city/zones';

describe('zones', () => {
  it('defines all six zones', () => {
    expect(Object.keys(ZONE_DEFS).sort()).toEqual(
      ['beachfront', 'downtown', 'highway', 'industrial', 'nightlife', 'residential'].sort(),
    );
  });

  it('assigns expected zones to known lots', () => {
    expect(blockZone(7, 0)).toBe('beachfront');
    expect(blockZone(4, 4)).toBe('downtown');
    expect(blockZone(3, 6)).toBe('nightlife');
    expect(blockZone(1, 1)).toBe('residential');
    expect(blockZone(0, 4)).toBe('industrial');
  });

  it('centers lots symmetrically across the grid', () => {
    expect(blockCenter(0)).toBe(-280);
    expect(blockCenter(CITY.grid - 1)).toBe(280);
  });

  it('maps world positions to zones', () => {
    expect(zoneAt(10, 10)).toBe('downtown');
    expect(zoneAt(348, 0)).toBe('beachfront');
    expect(zoneAt(0, 330)).toBe('highway');
    expect(zoneAt(-300, -300)).toBe('residential');
    expect(zoneAt(-300, 250)).toBe('industrial');
  });
});
