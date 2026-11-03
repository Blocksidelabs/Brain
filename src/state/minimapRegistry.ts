/**
 * Bridge so the engine render loop can draw into the React-owned minimap
 * canvas without funneling per-frame data through React state.
 */
let canvas: HTMLCanvasElement | null = null;
let drawer: ((canvas: HTMLCanvasElement) => void) | null = null;

export function registerMinimap(c: HTMLCanvasElement | null): void {
  canvas = c;
}

export function registerMinimapDrawer(fn: ((canvas: HTMLCanvasElement) => void) | null): void {
  drawer = fn;
}

export function drawMinimap(): void {
  if (canvas && drawer) drawer(canvas);
}
