import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Asset pipeline: optional GLB overrides with graceful fallbacks.
 *
 * Any model dropped into `public/assets/<folder>/<name>.glb` can replace a
 * procedural model at runtime (e.g. `assets/vehicles/coupe.glb`). If the
 * file is missing or fails to parse, the loader resolves `null` and the
 * game falls back to the built-in procedural model — never a crash.
 */
class AssetManager {
  private loader = new GLTFLoader();
  private cache = new Map<string, THREE.Group | null>();

  async loadOptionalGLB(url: string, timeoutMs = 4000): Promise<THREE.Group | null> {
    const cached = this.cache.get(url);
    if (cached !== undefined) return cached;
    const result = await new Promise<THREE.Group | null>((resolve) => {
      let settled = false;
      const finish = (group: THREE.Group | null) => {
        if (settled) return;
        settled = true;
        resolve(group);
      };
      const timer = window.setTimeout(() => finish(null), timeoutMs);
      this.loader.load(
        url,
        (gltf) => {
          window.clearTimeout(timer);
          finish(gltf.scene);
        },
        undefined,
        () => {
          window.clearTimeout(timer);
          finish(null);
        },
      );
    });
    this.cache.set(url, result);
    return result;
  }
}

export const assetManager = new AssetManager();
