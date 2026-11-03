import { PARK_LOT, PLAZA_LOT, type CityData } from './city/CityGenerator';
import { CITY } from '../config/gameConfig';
import { ZONE_DEFS, blockZone, blockCenter } from './city/zones';

const MAP_SPAN = 720;

/**
 * Renders a north-up minimap: a static top-down city image is drawn once,
 * then each frame a viewport around the player is blitted with a marker.
 */
export function createMinimapDrawer(
  data: CityData,
  marker: { x: number; z: number; yaw: number },
): (canvas: HTMLCanvasElement) => void {
  void data;
  const B = 512;
  const base = document.createElement('canvas');
  base.width = base.height = B;
  const bctx = base.getContext('2d');
  if (!bctx) return () => {};
  const s = B / MAP_SPAN;
  const px = (x: number) => (x + 360) * s;
  const pz = (z: number) => (z + 360) * s; // north (-z) at top

  bctx.fillStyle = '#0b3c5c';
  bctx.fillRect(px(CITY.waterlineX), 0, B - px(CITY.waterlineX), B);
  bctx.fillStyle = '#c8ae74';
  bctx.fillRect(px(330), pz(-340), px(CITY.waterlineX) - px(330), 680 * s);

  for (let bz = 0; bz < CITY.grid; bz++) {
    for (let bx = 0; bx < CITY.grid; bx++) {
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const isPlaza = bx === PLAZA_LOT.bx && bz === PLAZA_LOT.bz;
      const isPark = bx === PARK_LOT.bx && bz === PARK_LOT.bz;
      bctx.fillStyle = isPlaza ? '#3a4150' : isPark ? '#1d4a2e' : ZONE_DEFS[blockZone(bx, bz)].minimap;
      bctx.fillRect(px(cx - 32), pz(cz - 32), 64 * s, 64 * s);
    }
  }

  bctx.strokeStyle = '#3a3f4a';
  bctx.lineWidth = Math.max(1, 16 * s);
  for (let k = 0; k <= CITY.grid; k++) {
    const v = -320 + k * CITY.pitch;
    bctx.beginPath();
    bctx.moveTo(px(v), pz(-330));
    bctx.lineTo(px(v), pz(330));
    bctx.stroke();
    bctx.beginPath();
    bctx.moveTo(px(-330), pz(v));
    bctx.lineTo(px(330), pz(v));
    bctx.stroke();
  }

  return (canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const view = 130; // meters visible
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, W, H);
    const srcSpan = view * s;
    ctx.drawImage(
      base,
      px(marker.x) - srcSpan / 2,
      pz(marker.z) - srcSpan / 2,
      srcSpan,
      srcSpan,
      0,
      0,
      W,
      H,
    );
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-marker.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ff2d95';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };
}
