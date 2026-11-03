import * as THREE from 'three';
import { CITY } from '../../config/gameConfig';
import { mulberry32, type Rng } from '../../engine/mathUtils';
import { PARK_LOT, PLAZA_LOT } from './CityGenerator';
import { blockCenter, blockZone } from './zones';

const SIZE = 4096;
const WORLD = CITY.planeHalf * 2;

/**
 * The whole street plan — asphalt, lane markings, crosswalks, sidewalks,
 * sand, boardwalk, parking, plaza — painted once into a single 4K texture
 * and applied to one plane (1 draw call for the entire ground).
 */
export function buildGround(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const rng: Rng = mulberry32(4242);

  const px = (w: number) => ((w + CITY.planeHalf) / WORLD) * SIZE;
  const py = (z: number) => ((CITY.planeHalf - z) / WORLD) * SIZE;
  const ps = (m: number) => (m / WORLD) * SIZE;

  const rect = (x: number, z: number, w: number, d: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(px(x - w / 2), py(z + d / 2), ps(w), ps(d));
  };

  const ring0 = -(CITY.grid * CITY.pitch) / 2;

  const dashLineX = (x: number, from: number, to: number, width: number, dash: number, gap: number, color: string, skipNear?: number) => {
    for (let z = from; z < to; z += dash + gap) {
      if (skipNear !== undefined) {
        const rel = ((z - ring0) % CITY.pitch + CITY.pitch) % CITY.pitch;
        if (Math.min(rel, CITY.pitch - rel) < skipNear) continue;
      }
      rect(x, z + dash / 2, width, dash, color);
    }
  };

  const dashLineZ = (z: number, from: number, to: number, width: number, dash: number, gap: number, color: string, skipNear?: number) => {
    for (let x = from; x < to; x += dash + gap) {
      if (skipNear !== undefined) {
        const rel = ((x - ring0) % CITY.pitch + CITY.pitch) % CITY.pitch;
        if (Math.min(rel, CITY.pitch - rel) < skipNear) continue;
      }
      rect(x + dash / 2, z, dash, width, color);
    }
  };

  // ---- base ----
  ctx.fillStyle = '#0c0e13';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ---- lots ----
  const lotFill: Record<string, string> = {
    downtown: '#262a31',
    beachfront: '#272430',
    residential: '#23262b',
    nightlife: '#1c1e2a',
    industrial: '#292c33',
    highway: '#292c33',
  };
  for (let bz = 0; bz < CITY.grid; bz++) {
    for (let bx = 0; bx < CITY.grid; bx++) {
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const isPlaza = bx === PLAZA_LOT.bx && bz === PLAZA_LOT.bz;
      const isPark = bx === PARK_LOT.bx && bz === PARK_LOT.bz;
      if (isPlaza) {
        rect(cx, cz, 64, 64, '#2a2e38');
        continue;
      }
      if (isPark) {
        rect(cx, cz, 64, 64, '#1a3324');
        continue;
      }
      const zone = blockZone(bx, bz);
      rect(cx, cz, 64, 64, lotFill[zone]);
      if (zone === 'residential') {
        rect(cx, cz, 56, 56, '#17301f');
        for (let i = 0; i < 60; i++) {
          rect(cx - 26 + rng() * 52, cz - 26 + rng() * 52, 0.6, 0.6, rng() < 0.5 ? '#1d3d27' : '#122419');
        }
      }
      if (zone === 'downtown') rect(cx, cz, 58, 58, '#2b2f38');
      if (zone === 'industrial' || zone === 'nightlife') {
        for (let x = cx - 26; x <= cx + 26; x += 3.2) {
          rect(x, cz + 27, 0.25, 5, 'rgba(230,235,240,0.5)');
        }
      }
    }
  }

  // ---- beach ----
  rect(332, 0, 4, 680, '#4a3a28');
  for (let z = -338; z < 340; z += 2.4) rect(332, z + 1.2, 4, 0.09, 'rgba(0,0,0,0.25)');
  rect(345, 0, 22, 680, '#c8ae74');
  for (let i = 0; i < 2600; i++) {
    rect(334 + rng() * 21.5, -339 + rng() * 678, 0.4, 0.4, rng() < 0.5 ? '#b89c66' : '#dcc795');
  }
  rect(353.6, 0, 2.2, 680, '#a08a5e');
  rect(355.7, 0, 0.5, 680, '#e8f2ff');

  // ---- roads ----
  const asphalt = '#191c22';
  for (let k = 1; k < 8; k++) {
    const v = ring0 + k * CITY.pitch;
    rect(v, 0, 16, 656, asphalt);
    rect(0, v, 656, 16, asphalt);
  }
  rect(0, -320, 680, 16, asphalt);
  rect(-320, 0, 16, 680, asphalt);
  rect(320, 0, 20, 680, asphalt);
  rect(0, 320, 680, 26, asphalt);

  // clean intersection patches
  for (let kx = 0; kx <= 8; kx++) {
    for (let kz = 0; kz <= 8; kz++) {
      const ix = ring0 + kx * CITY.pitch;
      const iz = ring0 + kz * CITY.pitch;
      const w = kx === 8 ? 22 : 18;
      const d = kz === 8 ? 28 : 18;
      rect(ix, iz, w, d, asphalt);
    }
  }

  // ---- markings ----
  const yellow = '#c9b458';
  const white = 'rgba(235,240,245,0.85)';

  for (let k = 1; k < 8; k++) {
    const v = ring0 + k * CITY.pitch;
    dashLineX(v, -324, 324, 0.35, 3, 3, yellow, 14);
    dashLineZ(v, -324, 324, 0.35, 3, 3, yellow, 14);
    for (const off of [-7.6, 7.6]) {
      rect(v + off, 0, 0.3, 656, white);
      rect(0, v + off, 656, 0.3, white);
    }
  }

  // north + west ring roads
  dashLineZ(-320, -336, 336, 0.35, 3, 3, yellow, 14);
  dashLineX(-320, -336, 336, 0.35, 3, 3, yellow, 14);
  for (const off of [-7.6, 7.6]) {
    rect(0, -320 + off, 680, 0.3, white);
    rect(-320 + off, 0, 0.3, 680, white);
  }

  // coastal boulevard (east ring, 20 m)
  dashLineX(320, -336, 336, 0.4, 4, 4, white, 15);
  for (const off of [-9.4, 9.4]) rect(320 + off, 0, 0.35, 680, white);

  // sunset highway (south ring, 26 m)
  rect(0, 319.35, 680, 0.3, yellow);
  rect(0, 320.65, 680, 0.3, yellow);
  dashLineZ(314.5, -336, 336, 0.35, 5, 7, white, 16);
  dashLineZ(325.5, -336, 336, 0.35, 5, 7, white, 16);
  for (const off of [-12.2, 12.2]) rect(0, 320 + off, 680, 0.35, white);

  // ---- crosswalks at interior intersections ----
  for (let kx = 1; kx < 8; kx++) {
    for (let kz = 1; kz < 8; kz++) {
      const ix = ring0 + kx * CITY.pitch;
      const iz = ring0 + kz * CITY.pitch;
      for (const side of [-1, 1]) {
        for (let x = ix - 6.6; x <= ix + 6.6; x += 1.9) rect(x, iz + side * 10.2, 0.9, 2.2, white);
        for (let z = iz - 6.6; z <= iz + 6.6; z += 1.9) rect(ix + side * 10.2, z, 2.2, 0.9, white);
      }
    }
  }

  // ---- plaza + park dressing ----
  const pcx = blockCenter(PLAZA_LOT.bx);
  const pcz = blockCenter(PLAZA_LOT.bz);
  rect(pcx, pcz, 44, 4, '#343845');
  rect(pcx, pcz, 4, 44, '#343845');
  ctx.fillStyle = '#12314e';
  ctx.beginPath();
  ctx.arc(px(pcx), py(pcz), ps(9), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a4150';
  ctx.lineWidth = ps(1.2);
  ctx.stroke();

  const kcx = blockCenter(PARK_LOT.bx);
  const kcz = blockCenter(PARK_LOT.bz);
  rect(kcx, kcz, 4, 52, '#3a3630');
  rect(kcx, kcz, 52, 4, '#3a3630');

  // ---- mesh ----
  const texture = new THREE.CanvasTexture(c);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(WORLD, WORLD);
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.94, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = 'city-ground';
  return mesh;
}
