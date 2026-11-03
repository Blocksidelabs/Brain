import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { QualityPreset } from './quality';

export interface GameSystems {
  camera: THREE.PerspectiveCamera;
  update(dt: number, elapsed: number): void;
  dispose(): void;
  onQualityChanged?: (q: QualityPreset) => void;
  onResized?: (aspect: number) => void;
}

export interface GameBootContext {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  domElement: HTMLCanvasElement;
}

export interface GameManagerOptions {
  quality: QualityPreset;
  reducedMotion: boolean;
  onFps?: (fps: number) => void;
}

/** Engine orchestrator: renderer, post stack, frame loop, lifecycle. */
export class GameManager {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  private composer!: EffectComposer;
  private bloom: UnrealBloomPass | null = null;
  private systems: GameSystems | null = null;
  private clock = new THREE.Clock();
  private raf = 0;
  private paused = false;
  private disposed = false;
  private frames = 0;
  private fpsWindow = 0;
  private resizeObserver: ResizeObserver | null = null;
  private container: HTMLElement;
  private opts: GameManagerOptions;

  constructor(container: HTMLElement, opts: GameManagerOptions) {
    this.container = container;
    this.opts = opts;
  }

  async start(makeSystems: (ctx: GameBootContext) => Promise<GameSystems> | GameSystems): Promise<void> {
    const q = this.opts.quality;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(Math.max(1, this.container.clientWidth), Math.max(1, this.container.clientHeight));
    renderer.setPixelRatio(q.pixelRatio);
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    const style = renderer.domElement.style;
    style.width = '100%';
    style.height = '100%';
    style.display = 'block';
    style.outline = 'none';
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(q.pixelRatio);
    this.composer.setSize(Math.max(1, this.container.clientWidth), Math.max(1, this.container.clientHeight));

    this.systems = await makeSystems({
      scene: this.scene,
      renderer,
      domElement: renderer.domElement,
    });

    this.composer.addPass(new RenderPass(this.scene, this.systems.camera));
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), q.bloomStrength, 0.5, 0.82);
    this.bloom.enabled = q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
    this.clock.start();
    this.loop();
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (!this.paused && this.systems) {
      this.systems.update(dt, this.clock.elapsedTime);
    }
    this.composer.render();

    this.frames++;
    this.fpsWindow += dt;
    if (this.fpsWindow >= 0.5) {
      this.opts.onFps?.(Math.round(this.frames / this.fpsWindow));
      this.frames = 0;
      this.fpsWindow = 0;
    }
  };

  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.clock.getDelta(); // discard the pause gap
  }

  setQuality(q: QualityPreset): void {
    this.opts.quality = q;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.composer.setPixelRatio(q.pixelRatio);
    this.onResize();
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    if (this.bloom) {
      this.bloom.strength = q.bloomStrength;
      this.bloom.enabled = q.bloom;
    }
    this.systems?.onQualityChanged?.(q);
  }

  private onResize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.systems?.onResized?.(w / h);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.systems?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.clear();
  }
}
