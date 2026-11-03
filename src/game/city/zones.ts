import { CITY } from '../../config/gameConfig';

export type ZoneId =
  | 'downtown'
  | 'beachfront'
  | 'residential'
  | 'nightlife'
  | 'industrial'
  | 'highway';

export interface ZoneDef {
  id: ZoneId;
  label: string;
  minimap: string;
}

export const ZONE_DEFS: Record<ZoneId, ZoneDef> = {
  downtown: { id: 'downtown', label: 'DOWNTOWN', minimap: '#ff2d95' },
  beachfront: { id: 'beachfront', label: 'OCEANFRONT', minimap: '#29b6f6' },
  residential: { id: 'residential', label: 'PALM GROVE HEIGHTS', minimap: '#2e8b6b' },
  nightlife: { id: 'nightlife', label: 'NEON DISTRICT', minimap: '#9d4edd' },
  industrial: { id: 'industrial', label: 'DOCKSIDE INDUSTRIAL', minimap: '#8a94a6' },
  highway: { id: 'highway', label: 'SUNSET HIGHWAY', minimap: '#5a5f6e' },
};

/** Zone for a city lot (grid coords 0..CITY.grid-1). */
export function blockZone(bx: number, bz: number): ZoneId {
  if (bx === CITY.grid - 1) return 'beachfront';
  if (bx >= 3 && bx <= 5 && bz >= 3 && bz <= 4) return 'downtown';
  if (bz >= 5 && bz <= 6 && bx >= 2 && bx <= 5) return 'nightlife';
  if (bz <= 2) return 'residential';
  if (bx <= 1) return 'industrial';
  return 'residential';
}

/** World-space center of lot index bi on one axis. */
export function blockCenter(bi: number): number {
  return bi * CITY.pitch - (CITY.grid * CITY.pitch) / 2 + CITY.pitch / 2;
}

/** Human-readable zone for an arbitrary world position (used by HUD). */
export function zoneAt(x: number, z: number): ZoneId {
  const half = (CITY.grid * CITY.pitch) / 2;
  if (z >= half - CITY.highwayWidth / 2 - 2) return 'highway';
  if (x >= half - CITY.coastalRoadWidth / 2 - 2) return 'beachfront';
  const gx = Math.floor((x + half) / CITY.pitch);
  const gz = Math.floor((z + half) / CITY.pitch);
  const bx = Math.min(CITY.grid - 1, Math.max(0, gx));
  const bz = Math.min(CITY.grid - 1, Math.max(0, gz));
  return blockZone(bx, bz);
}
