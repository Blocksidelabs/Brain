import * as THREE from 'three';
import { CAMERA, PLAYER } from '../config/gameConfig';
import { clamp, damp, lerp } from './mathUtils';
import type { PhysicsManager } from './PhysicsManager';
import type RAPIER from '@dimforge/rapier3d-compat';

export type CameraMode = 'third' | 'first';

const TMP_LOOK = new THREE.Vector3();
const TMP_DIR = new THREE.Vector3();

/**
 * Third-person orbit camera with collision avoidance and a smooth
 * transition into first person (distance -> 0 keeps position continuity).
 */
export class CameraManager {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'third';
  yaw = Math.PI;
  pitch = -0.08;
  sens = 1;
  invertY = false;
  reducedMotion = false;
  private physics: PhysicsManager;
  private dist: number = CAMERA.thirdDist;
  private targetDist: number = CAMERA.thirdDist;
  private smoothDist: number = CAMERA.thirdDist;

  constructor(aspect: number, physics: PhysicsManager) {
    this.physics = physics;
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.farHigh);
    this.camera.rotation.order = 'YXZ';
  }

  setSpawn(yaw: number): void {
    this.yaw = yaw;
    this.pitch = -0.08;
    this.dist = CAMERA.thirdDist;
    this.targetDist = CAMERA.thirdDist;
    this.smoothDist = CAMERA.thirdDist;
  }

  applyLook(dx: number, dy: number): void {
    const s = CAMERA.sensDefault * this.sens;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s * (this.invertY ? -1 : 1), -1.25, 1.35);
  }

  zoom(delta: number): void {
    if (this.mode !== 'third') return;
    this.targetDist = clamp(this.targetDist + delta * 0.004, 1.8, CAMERA.maxDist);
  }

  toggleMode(): void {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    this.targetDist = this.mode === 'first' ? 0 : CAMERA.thirdDist;
  }

  /** True once the rig has blended close enough to behave as first person. */
  get firstPerson(): boolean {
    return this.dist < 0.8;
  }

  update(dt: number, targetPos: THREE.Vector3, playerBody: RAPIER.RigidBody): void {
    this.dist = damp(this.dist, this.targetDist, this.reducedMotion ? 30 : 9, dt);

    const cp = Math.cos(this.pitch);
    TMP_LOOK.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);

    const fpBlend = 1 - clamp(this.dist / CAMERA.thirdDist, 0, 1);
    const pivotY = targetPos.y + lerp(CAMERA.height, PLAYER.eyeHeight, fpBlend);

    // Collision: ray from pivot towards the desired camera position.
    const len = this.dist;
    TMP_DIR.copy(TMP_LOOK).negate();
    const hit = this.physics.rayDistance(
      { x: targetPos.x, y: pivotY, z: targetPos.z },
      { x: TMP_DIR.x, y: TMP_DIR.y, z: TMP_DIR.z },
      len + 0.35,
      playerBody,
    );
    const clamped = hit !== null ? Math.max(0.45, hit - 0.3) : len;
    this.smoothDist = damp(this.smoothDist, clamped, this.reducedMotion ? 60 : 22, dt);

    if (this.smoothDist < 0.05) {
      // First person: camera at eye level, rotated with the look direction.
      this.camera.position.set(
        targetPos.x + TMP_LOOK.x * 0.18,
        pivotY,
        targetPos.z + TMP_LOOK.z * 0.18,
      );
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    } else {
      this.camera.position.set(
        targetPos.x + TMP_DIR.x * this.smoothDist,
        pivotY + TMP_DIR.y * this.smoothDist,
        targetPos.z + TMP_DIR.z * this.smoothDist,
      );
      this.camera.lookAt(targetPos.x + TMP_LOOK.x * 2, pivotY + TMP_LOOK.y * 2, targetPos.z + TMP_LOOK.z * 2);
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setFar(far: number): void {
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }
}
