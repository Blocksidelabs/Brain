import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, type Rng } from '../../engine/mathUtils';
import type { BuildingSpec } from './CityGenerator';

/**
 * Detailed-building kit of parts.
 *
 * Every building is assembled from small boxes (walls, window rows,
 * balconies, parapets, rooftop structures, entrances) and merged into two
 * geometries: a vertex-coloured opaque structure and a window-glow layer
 * (per-window hue baked into vertex colours, brightness animated globally
 * by the day/night cycle). Result: a few hundred draw calls for a whole
 * detailed city instead of thousands.
 */

export interface BuildingStyle {
  structure: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
}

const PALETTES = {
  downtown: [0x5d6b85, 0x4e5a70, 0x77808f, 0x8b93a3, 0x6a7285],
  office: [0x8a8f9a, 0x7c8288, 0x9aa3ad, 0x6f7681],
  hotel: [0xe8d9c4, 0xd8cfc0, 0xcfe3e8, 0xe3d3d8],
  apartment: [0x9aa39b, 0x8f9a85, 0xa89f92, 0x8c877a],
  shops: [0xa39a8a, 0x8a8276, 0xb0a48e],
  club: [0x2c2836, 0x232030, 0x302942],
  house: [0xc9a37a, 0xb8875e, 0x9fb0a5, 0xcf9d76, 0xd9c9a8],
  warehouse: [0x6a6f78, 0x7a7266, 0x5d6570],
};

const WIN_WARM = new THREE.Color(1, 0.82, 0.55);
const WIN_COOL = new THREE.Color(0.6, 0.9, 1);
const WIN_PINK = new THREE.Color(1, 0.6, 0.85);

function push(list: THREE.BufferGeometry[], geo: THREE.BufferGeometry): void {
  list.push(geo);
}

function box(
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
  ry = 0,
  rx = 0,
): void {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  push(list, g);
}

function glowBox(
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rng: Rng,
  ry = 0,
): void {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  const r = rng();
  const c = r < 0.62 ? WIN_WARM : r < 0.85 ? WIN_COOL : WIN_PINK;
  const dim = 0.55 + rng() * 0.45;
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r * dim;
    colors[i * 3 + 1] = c.g * dim;
    colors[i * 3 + 2] = c.b * dim;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  push(list, g);
}

/** Window grid on the two z-facing facades (front −z, back +z). */
function windowsZ(
  glow: THREE.BufferGeometry[],
  rng: Rng,
  w: number,
  floors: number,
  baseY: number,
  floorH: number,
  z: number,
  cols: number,
  winW: number,
  winH: number,
  inset: number,
): void {
  for (let f = 0; f < floors; f++) {
    const y = baseY + f * floorH + floorH * 0.55;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + ((c + 0.5) * w) / cols;
      for (const side of [-1, 1]) {
        glowBox(glow, winW, winH, 0.1, x, y, z + side * inset, rng);
      }
    }
  }
}

/** Window grid on the two x-facing facades. */
function windowsX(
  glow: THREE.BufferGeometry[],
  rng: Rng,
  d: number,
  floors: number,
  baseY: number,
  floorH: number,
  x: number,
  cols: number,
  winW: number,
  winH: number,
  inset: number,
): void {
  for (let f = 0; f < floors; f++) {
    const y = baseY + f * floorH + floorH * 0.55;
    for (let c = 0; c < cols; c++) {
      const z = -d / 2 + ((c + 0.5) * d) / cols;
      for (const side of [-1, 1]) {
        glowBox(glow, 0.1, winH, winW, x + side * inset, y, z, rng);
      }
    }
  }
}

type Archetype = 'tower' | 'office' | 'hotel' | 'apartment' | 'shops' | 'club' | 'house' | 'warehouse';

function archetypeFor(b: BuildingSpec): Archetype {
  switch (b.zone) {
    case 'downtown':
      return b.h > 40 ? 'tower' : 'office';
    case 'beachfront':
      return 'hotel';
    case 'nightlife':
      return b.h > 18 ? 'club' : 'shops';
    case 'industrial':
      return 'warehouse';
    default:
      return b.h > 7 ? 'apartment' : 'house';
  }
}

function parapet(
  structure: THREE.BufferGeometry[],
  w: number,
  d: number,
  y: number,
  color: number,
): void {
  box(structure, w + 0.3, 0.5, 0.28, 0, y, -d / 2 - 0.01, color);
  box(structure, w + 0.3, 0.5, 0.28, 0, y, d / 2 + 0.01, color);
  box(structure, 0.28, 0.5, d + 0.3, -w / 2 - 0.01, y, 0, color);
  box(structure, 0.28, 0.5, d + 0.3, w / 2 + 0.01, y, 0, color);
}

function roofGear(
  structure: THREE.BufferGeometry[],
  glow: THREE.BufferGeometry[],
  rng: Rng,
  w: number,
  d: number,
  roofY: number,
  _wall: number,
): void {
  box(structure, 3.6, 2.1, 2.8, w / 4, roofY + 1.05, d / 4, 0x8a8f99); // stair hut
  box(structure, 0.7, 1.6, 0.7, -w / 3, roofY + 0.8, -d / 3, 0x9aa0a8); // AC
  if (rng() < 0.7) box(structure, 0.9, 1.3, 0.9, w / 3, roofY + 0.65, -d / 4, 0x9aa0a8);
  box(structure, 0.1, 2.8, 0.1, -w / 4, roofY + 1.4, 0, 0x5a6068); // antenna
  void glow;
}

function buildTower(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.downtown[Math.floor(rng() * PALETTES.downtown.length)];
  const pier = 0x39404e;
  box(structure, w, h, d, 0, h / 2, 0, wall);
  box(structure, 1.1, h, 1.1, w / 2 - 0.55, h / 2, d / 2 - 0.55, pier);
  box(structure, 1.1, h, 1.1, -w / 2 + 0.55, h / 2, d / 2 - 0.55, pier);
  box(structure, 1.1, h, 1.1, w / 2 - 0.55, h / 2, -d / 2 + 0.55, pier);
  box(structure, 1.1, h, 1.1, -w / 2 + 0.55, h / 2, -d / 2 + 0.55, pier);
  const floors = Math.floor((h - 5) / 3.1);
  windowsZ(glow, rng, w - 1.6, floors, 3.4, 3.1, 0, Math.min(9, Math.floor((w - 2) / 2.4)), 1.5, 1.7, d / 2 - 0.02);
  windowsX(glow, rng, d - 1.6, floors, 3.4, 3.1, 0, Math.min(9, Math.floor((d - 2) / 2.4)), 1.5, 1.7, w / 2 - 0.02);
  parapet(structure, w, d, h, pier);
  let roofY = h;
  if (h > 55) {
    const th = h * 0.2;
    box(structure, w * 0.62, th, d * 0.62, 0, h + th / 2, 0, wall);
    windowsZ(glow, rng, w * 0.5, Math.floor(th / 3.1) - 1, h + 1, 3.1, 0, Math.min(7, Math.floor((w * 0.6) / 2.4)), 1.4, 1.6, (d * 0.62) / 2 - 0.02);
    windowsX(glow, rng, d * 0.5, Math.floor(th / 3.1) - 1, h + 1, 3.1, 0, Math.min(7, Math.floor((d * 0.6) / 2.4)), 1.4, 1.6, (w * 0.62) / 2 - 0.02);
    roofY = h + th;
  }
  roofGear(structure, glow, rng, w * 0.8, d * 0.8, roofY, wall);
  box(structure, 3.4, 0.25, 1.7, 0, 3.35, -d / 2 - 0.85, 0x2a2e38); // entrance canopy
  glowBox(glow, 1.7, 2.5, 0.12, 0, 1.3, -d / 2 - 0.06, rng); // doors
  return finalize(structure, glow);
}

function buildOffice(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.office[Math.floor(rng() * PALETTES.office.length)];
  box(structure, w, h, d, 0, h / 2, 0, wall);
  const floors = Math.floor((h - 4.4) / 3.4);
  for (let f = 0; f < floors; f++) {
    const y = 3.2 + f * 3.4 + 0.8;
    glowBox(glow, w - 1.4, 1.35, 0.12, 0, y, -d / 2 - 0.03, rng);
    glowBox(glow, w - 1.4, 1.35, 0.12, 0, y, d / 2 + 0.03, rng);
    glowBox(glow, 0.12, 1.35, d - 1.4, -w / 2 - 0.03, y, 0, rng);
    glowBox(glow, 0.12, 1.35, d - 1.4, w / 2 + 0.03, y, 0, rng);
    // mullions
    for (let mx = -w / 2 + 1.7; mx < w / 2 - 1; mx += 1.7) {
      box(structure, 0.14, 1.4, 0.14, mx, y, -d / 2 + 0.02, 0x30343e);
      box(structure, 0.14, 1.4, 0.14, mx, y, d / 2 - 0.02, 0x30343e);
    }
  }
  parapet(structure, w, d, h, 0x30343e);
  roofGear(structure, glow, rng, w * 0.85, d * 0.85, h, wall);
  glowBox(glow, 1.7, 2.4, 0.12, 0, 1.3, -d / 2 - 0.06, rng);
  box(structure, 3.2, 0.22, 1.5, 0, 2.9, -d / 2 - 0.75, 0x2a2e38);
  return finalize(structure, glow);
}

function buildHotel(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.hotel[Math.floor(rng() * PALETTES.hotel.length)];
  box(structure, w, h, d, 0, h / 2, 0, wall);
  const floors = Math.floor((h - 4) / 3.2);
  for (let f = 0; f < floors; f++) {
    const y = 3.4 + f * 3.2;
    for (const side of [-1, 1]) {
      box(structure, w - 1.6, 0.14, 1.15, 0, y, side * (d / 2 + 0.55), 0xd9cfc0);
      box(structure, w - 1.6, 0.7, 0.08, 0, y + 0.45, side * (d / 2 + 1.06), 0xbfb4a4);
      glowBox(glow, w - 2.2, 1.5, 0.12, 0, y + 0.95, side * (d / 2 - 0.03), rng);
    }
    glowBox(glow, 0.12, 1.5, d - 2.2, -w / 2 - 0.03, y + 0.95, 0, rng);
    glowBox(glow, 0.12, 1.5, d - 2.2, w / 2 + 0.03, y + 0.95, 0, rng);
  }
  parapet(structure, w, d, h, 0xbfb4a4);
  box(structure, w * 0.4, 0.5, d * 0.3, w / 5, h + 0.25, 0, 0x3aa8c8); // rooftop pool
  box(structure, 3, 2, 2.4, -w / 4, h + 1, d / 4, 0xd9cfc0);
  glowBox(glow, 1.6, 2.3, 0.12, 0, 1.3, -d / 2 - 0.06, rng);
  box(structure, 3.4, 0.25, 1.7, 0, 3.2, -d / 2 - 0.85, 0x8a7f6e);
  return finalize(structure, glow);
}

function buildApartment(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.apartment[Math.floor(rng() * PALETTES.apartment.length)];
  box(structure, w, h, d, 0, h / 2, 0, wall);
  const floors = Math.floor((h - 3) / 3);
  for (let f = 0; f < floors; f++) {
    const y = 2.8 + f * 3;
    windowsZ(glow, rng, w - 2, 1, y, 0, 0, Math.floor((w - 1.4) / 2.2), 1.1, 1.3, d / 2 - 0.02);
    windowsX(glow, rng, d - 2, 1, y, 0, 0, Math.floor((d - 1.4) / 2.2), 1.1, 1.3, w / 2 - 0.02);
    if (f < floors - 1) {
      box(structure, w - 2.4, 0.12, 0.9, 0, y + 0.1, -d / 2 - 0.45, 0xb0a898);
      box(structure, w - 2.4, 0.6, 0.07, 0, y + 0.45, -d / 2 - 0.86, 0xb0a898);
    }
  }
  parapet(structure, w, d, h, 0x8a8478);
  box(structure, 1.2, 2.2, 0.12, 0, 1.1, -d / 2 - 0.06, 0x4a4438); // door
  glowBox(glow, 0.8, 1.9, 0.12, w / 4, 1.05, -d / 2 - 0.06, rng);
  return finalize(structure, glow);
}

function buildShops(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.shops[Math.floor(rng() * PALETTES.shops.length)];
  box(structure, w, h, d, 0, h / 2, 0, wall);
  const bays = Math.max(2, Math.floor(w / 4));
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / bays;
    glowBox(glow, w / bays - 0.7, 2.3, 0.12, x, 1.25, -d / 2 - 0.04, rng);
    box(structure, w / bays - 0.5, 0.12, 1.1, x, 2.6, -d / 2 - 0.5, i % 2 ? 0x7a3d44 : 0x34535e, 0, 0.16);
  }
  if (h > 4.5) {
    windowsZ(glow, rng, w - 2, Math.floor((h - 4.6) / 2.8), 4.4, 2.8, 0, Math.floor((w - 1.4) / 2.4), 1.1, 1.2, d / 2 - 0.02);
  }
  parapet(structure, w, d, h, 0x6a6258);
  glowBox(glow, 0.9, 2.2, 0.12, w / 2 - 1.2, 1.15, -d / 2 - 0.04, rng);
  return finalize(structure, glow);
}

function buildClub(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.club[Math.floor(rng() * PALETTES.club.length)];
  box(structure, w, h, d, 0, h / 2, 0, wall);
  for (const side of [-1, 1]) {
    glowBox(glow, w + 0.2, 0.22, 0.22, 0, h - 0.1, side * (d / 2 + 0.09), rng);
    glowBox(glow, 0.22, 0.22, d + 0.2, side * (w / 2 + 0.09), h - 0.1, 0, rng);
  }
  for (let x = -w / 2 + 1.5; x <= w / 2 - 1.5; x += 3) {
    glowBox(glow, 0.16, h - 2.4, 0.16, x, h / 2, -d / 2 - 0.1, rng);
  }
  glowBox(glow, 2.4, 2.6, 0.12, 0, 1.35, -d / 2 - 0.06, rng);
  box(structure, w * 0.5, 0.2, 1.4, 0, 2.8, -d / 2 - 0.6, 0x181420);
  roofGear(structure, glow, rng, w * 0.7, d * 0.7, h, wall);
  return finalize(structure, glow);
}

function buildHouse(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.house[Math.floor(rng() * PALETTES.house.length)];
  const wallH = h * 0.72;
  box(structure, w, wallH, d, 0, wallH / 2, 0, wall);
  const overhang = 0.35;
  const rise = h - wallH;
  const slabLen = Math.hypot(d / 2 + overhang, rise);
  const angle = Math.atan2(rise, d / 2 + overhang);
  box(structure, w + 0.7, 0.12, slabLen, 0, wallH + rise / 2, -(d / 4 + overhang / 4), 0x5a3f35, 0, angle);
  box(structure, w + 0.7, 0.12, slabLen, 0, wallH + rise / 2, d / 4 + overhang / 4, 0x5a3f35, 0, -angle);
  box(structure, w * 0.5, 0.2, 1.2, -w / 4, 0.1, -d / 2 - 0.55, 0x8a7f6e); // porch
  box(structure, 0.95, 2.0, 0.12, -w / 4, 1.0, -d / 2 - 0.05, 0x4a3428); // door
  glowBox(glow, 0.9, 1.1, 0.12, w / 4, 1.6, -d / 2 - 0.04, rng);
  glowBox(glow, 0.9, 1.1, 0.12, w / 4, 1.6, d / 2 + 0.04, rng);
  glowBox(glow, 0.12, 1.1, 0.9, -w / 2 - 0.04, 1.6, d / 4, rng);
  box(structure, 0.5, rise * 0.8, 0.5, w / 4, wallH + rise / 2 + 0.2, 0, 0x7a5a4a); // chimney
  box(structure, w * 0.4, 0.06, d / 2 + 1.2, w / 4, 0.03, d / 2 + 0.6, 0x565b64); // driveway
  return finalize(structure, glow);
}

function buildWarehouse(s: BuildingSpec, rng: Rng): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const { w, d, h } = s;
  const wall = PALETTES.warehouse[Math.floor(rng() * PALETTES.warehouse.length)];
  box(structure, w, h, d, 0, h / 2, 0, wall);
  const doors = Math.max(2, Math.floor(w / 12));
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / doors;
    box(structure, 2.2, 2.8, 0.14, x, 1.5, -d / 2 - 0.06, 0x4c5158);
    box(structure, 2.2, 0.14, d / 2, x, 0.14, -d / 2 + d / 4, 0x8b9099);
    glowBox(glow, 0.5, 0.25, 0.12, x, 3.4, -d / 2 - 0.05, rng);
  }
  parapet(structure, w, d, h, 0x565b64);
  for (let vx = -w / 2 + 2; vx <= w / 2 - 2; vx += 4) {
    box(structure, 0.8, 0.6, 0.8, vx, h + 0.3, d / 4, 0x7c828a);
  }
  box(structure, 1.1, 2.1, 0.12, w / 2 - 1.5, 1.05, -d / 2 - 0.06, 0x3f434a);
  return finalize(structure, glow);
}

/** Gas station: canopy on pillars, shop, pump islands. */
export function buildGasStationStyle(): BuildingStyle {
  const structure: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const rng = mulberry32(777);
  box(structure, 9, 3.6, 4.6, -8.5, 1.8, 0, 0xdcd6c8); // shop
  box(structure, 9.4, 0.5, 5, -8.5, 3.85, 0, 0x39424e);
  for (const px of [-4.5, 4.5]) {
    for (const pz of [-3.5, 3.5]) {
      box(structure, 0.42, 4.6, 0.42, px, 2.3, pz, 0x8a8f98);
    }
  }
  box(structure, 14, 0.55, 9, 0, 4.85, 0, 0x2f6db8); // canopy
  box(structure, 13.6, 0.16, 8.6, 0, 5.2, 0, 0xe8e2d4);
  glowBox(glow, 12.6, 0.12, 8, 0, 4.62, 0, rng);
  for (const px of [-1.8, 1.8]) {
    box(structure, 0.6, 1.25, 1.9, px, 0.62, 0, 0xc4c9cf);
    box(structure, 0.42, 1.0, 0.6, px, 1.2, -0.45, 0x3a3f47);
    glowBox(glow, 0.3, 0.34, 0.1, px, 1.28, 0, rng);
  }
  return finalize(structure, glow);
}

function finalize(structure: THREE.BufferGeometry[], glow: THREE.BufferGeometry[]): BuildingStyle {
  const structureGeo = mergeGeometries(structure, false)!;
  const glowGeo = mergeGeometries(glow, false)!;
  structureGeo.computeBoundingSphere();
  glowGeo.computeBoundingSphere();
  return { structure: structureGeo, glow: glowGeo };
}

const cache = new Map<string, BuildingStyle>();

/** Deterministic, cached detailed style for a building spec. */
export function getBuildingStyle(b: BuildingSpec, variant: number): BuildingStyle {
  const a = archetypeFor(b);
  const key = `${a}|${Math.round(b.w * 2)}|${Math.round(b.d * 2)}|${Math.round(b.h * 2)}|${variant}`;
  let style = cache.get(key);
  if (!style) {
    const rng = mulberry32(
      Math.abs(Math.round((b.x * 73 + b.z * 131 + b.h * 17 + variant * 29) | 0)) + 1,
    );
    const builders: Record<Archetype, (s: BuildingSpec, rng: Rng) => BuildingStyle> = {
      tower: buildTower,
      office: buildOffice,
      hotel: buildHotel,
      apartment: buildApartment,
      shops: buildShops,
      club: buildClub,
      house: buildHouse,
      warehouse: buildWarehouse,
    };
    style = builders[a](b, rng);
    cache.set(key, style);
  }
  return style;
}

export function buildingStyleCount(): number {
  return cache.size;
}

