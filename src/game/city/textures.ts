import * as THREE from 'three';
import { mulberry32, rngPick, type Rng } from '../../engine/mathUtils';

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [c, ctx];
}

function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

export interface BuildingTexSet {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

const LIT_COLORS = ['#ffd9a3', '#9fe8ff', '#ff9ad5', '#fff6e0', '#baffd9'];

/** Procedural facade: dark walls by day, a grid of lit windows by night. */
export function makeBuildingTextures(seed: number, rows: number): BuildingTexSet {
  const rng: Rng = mulberry32(seed);
  const cols = 6;
  const W = 128;
  const H = 256;

  const [c, ctx] = canvas2d(W, H);
  ctx.fillStyle = '#101319';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let r = 0; r < rows; r++) ctx.fillRect(0, Math.floor((r / rows) * H), W, 2);

  const [ec, ectx] = canvas2d(W, H);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, W, H);

  const cellH = H / rows;
  const cellW = W / cols;
  const padX = cellW * 0.22;
  const padY = cellH * 0.26;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW + padX;
      const y = r * cellH + padY;
      const w = cellW - padX * 2;
      const h = Math.max(2, cellH - padY * 1.6);
      ctx.fillStyle = 'rgba(150,190,220,0.10)';
      ctx.fillRect(x, y, w, h);
      if (rng() < 0.42) {
        ectx.fillStyle = rngPick(rng, LIT_COLORS);
        ectx.fillRect(x, y, w, h);
      }
    }
  }
  return { map: tex(c), emissiveMap: tex(ec) };
}

export const SIGN_LABELS: Array<{ text: string; color: string }> = [
  { text: 'NEON', color: '#ff2d95' },
  { text: 'PALMS', color: '#2ee6a8' },
  { text: 'CLUB VOLT', color: '#b46bff' },
  { text: 'HOTEL LUNA', color: '#4dc9ff' },
  { text: 'DINER 24H', color: '#ffb347' },
  { text: 'TATTOO', color: '#ff5c5c' },
  { text: 'RAMEN-BAR', color: '#ffe066' },
  { text: 'ARCADE', color: '#7dff8a' },
  { text: 'MOTEL', color: '#ff8ad1' },
  { text: 'ROOFTOP', color: '#66e0ff' },
  { text: 'SUNSET GRILL', color: '#ff7a3c' },
  { text: 'GARAGE 9', color: '#c9d64a' },
];

/** Glowing neon sign plaque (transparent background, HDR-bright when tinted). */
export function makeSignTexture(label: { text: string; color: string }): THREE.CanvasTexture {
  const W = 512;
  const H = 192;
  const [c, ctx] = canvas2d(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = label.color;
  ctx.lineWidth = 6;
  ctx.shadowColor = label.color;
  ctx.shadowBlur = 22;
  roundRectPath(ctx, 10, 10, W - 20, H - 20, 18);
  ctx.stroke();

  ctx.font = '900 72px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const scale = label.text.length > 8 ? 0.7 : 1;
  ctx.save();
  ctx.translate(W / 2, H / 2 + 4);
  ctx.scale(scale, 1);
  ctx.shadowBlur = 26;
  ctx.fillStyle = label.color;
  ctx.fillText(label.text, 0, 0);
  ctx.shadowBlur = 8;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label.text, 0, 0);
  ctx.restore();
  return tex(c);
}

/** Large landmark billboard for downtown. */
export function makeBillboardTexture(line1: string, line2: string | null): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const [c, ctx] = canvas2d(W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12081f');
  bg.addColorStop(1, '#0b1026');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#ff2d95';
  ctx.lineWidth = 10;
  ctx.shadowColor = '#ff2d95';
  ctx.shadowBlur = 30;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  const grad = ctx.createLinearGradient(0, H * 0.25, W, H * 0.55);
  grad.addColorStop(0, '#ff2d95');
  grad.addColorStop(1, '#9d4edd');
  ctx.font = '900 130px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2d95';
  ctx.shadowBlur = 44;
  ctx.fillStyle = grad;
  ctx.fillText(line1, W / 2, line2 ? H * 0.4 : H * 0.5);

  if (line2) {
    ctx.shadowColor = '#4dc9ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#bfeaff';
    ctx.font = '700 52px "Arial Black", Arial, sans-serif';
    ctx.fillText(line2, W / 2, H * 0.72);
  }
  return tex(c);
}

/** Soft radial glow — lamp pools, sun/moon discs, stars. */
export function makeGlowTexture(inner: string, mid?: string): THREE.CanvasTexture {
  const [c, ctx] = canvas2d(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(mid ? 0.42 : 1, mid ?? inner);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return tex(c);
}

/** Stylized palm frond with transparent background. */
export function makeFrondTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 256;
  const [c, ctx] = canvas2d(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#2c6b3a';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(W / 2, H - 4);
  ctx.quadraticCurveTo(W / 2 + 8, H * 0.55, W / 2, 8);
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const y = H - 10 - t * (H - 20);
    const len = (1 - Math.abs(t - 0.45) * 1.5) * 52 + 10;
    ctx.fillStyle = i % 2 ? '#2f8f4a' : '#3fae5c';
    ctx.beginPath();
    ctx.ellipse(W / 2 - len * 0.55, y, len * 0.55, 7, -0.5 - t * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W / 2 + len * 0.55, y, len * 0.55, 7, 0.5 + t * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return tex(c);
}

