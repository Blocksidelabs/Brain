import * as THREE from 'three';
import { CAMERA, PLAYER } from '../config/gameConfig';
import { clamp, damp, dampAngle, lerp } from './mathUtils';
import type { PhysicsManager } from './PhysicsManager';
import type RAPIER from '@dimforge/rapier3d-compat';

export type CameraMode = 'third' | 'first';

/** Anything the camera can drive behind/inside (implemented by Vehicle). */
export interface DrivingTarget {
  getPosition(): THREE.Vector3;
  getYaw(): number;
  getSteer(): number;
  speedMps(): number;
  getBody(): RAPIER.RigidBody;
  getEyeOffset(): { x: number; y: number; z: number };
}

const DRIVE = { dist: 6.6, min: 4.2, max: 11, height: 1.25 };
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const TMP_LOOK = new THREE.Vector3();
const TMP_DIR = new THREE.Vector3();
const ORBIT_POS = new THREE.Vector3();
const COCKPIT_POS = new THREE.Vector3();

/**
 * Third-person orbit camera with collision avoidance and a smooth
 * transition into first person (distance -> 0 keeps position continuity).
 * While driving, the rig follows the vehicle with a steering lean and a
 * cockpit perspective; on-foot behavior is unchanged.
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
  private drive: DrivingTarget | null = null;
  private driveOrbit = 0;
  private fpDrive = 0;
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

  /** Attach/detach the driving rig. */
  setDriving(target: DrivingTarget | null): void {
    this.drive = target;
    this.driveOrbit = 0;
    if (target) {
      this.targetDist = this.mode === 'first' ? 0 : DRIVE.dist;
    }
  }

  applyLook(dx: number, dy: number): void {
    const s = CAMERA.sensDefault * this.sens;
    if (this.drive) {
      this.driveOrbit -= dx * s; // temporary orbit; auto-recenters while moving
    } else {
      this.yaw -= dx * s;
    }
    this.pitch = clamp(this.pitch - dy * s * (this.invertY ? -1 : 1), -1.25, 1.35);
  }

  zoom(delta: number): void {
    if (this.mode !== 'third') return;
    const min = this.drive ? DRIVE.min : 1.8;
    const max = this.drive ? DRIVE.max : CAMERA.maxDist;
    this.targetDist = clamp(this.targetDist + delta * 0.004, min, max);
  }

  toggleMode(): void {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    const thirdDist = this.drive ? DRIVE.dist : CAMERA.thirdDist;
    this.targetDist = this.mode === 'first' ? 0 : thirdDist;
  }

  /** True once the rig has blended close enough to behave as first person. */
  get firstPerson(): boolean {
    return this.dist < 0.8;
  }

  update(dt: number, targetPos: THREE.Vector3, playerBody: RAPIER.RigidBody): void {
    if (this.drive) {
      this.updateDrive(dt);
      return;
    }
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

  /** Driving rig: follow cam with steering lean + blendable cockpit view. */
  private updateDrive(dt: number): void {
    const v = this.drive!;
    this.fpDrive = damp(this.fpDrive, this.mode === 'first' ? 1 : 0, 6, dt);
    const vPos = v.getPosition();
    const speed = v.speedMps();

    // camera yaw chases the vehicle heading + a steering lean; mouse adds a
    // temporary orbit that auto-recenters the faster you go
    this.driveOrbit = damp(this.driveOrbit, 0, 1.2 + speed * 0.1, dt);
    const desiredYaw = v.getYaw() + v.getSteer() * 0.35 + this.driveOrbit;
    this.yaw = dampAngle(this.yaw, desiredYaw, this.reducedMotion ? 40 : 5, dt);
    this.dist = damp(this.dist, this.targetDist, this.reducedMotion ? 30 : 9, dt);

    const cp = Math.cos(this.pitch);
    TMP_LOOK.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    const pivotY = vPos.y + DRIVE.height;

    TMP_DIR.copy(TMP_LOOK).negate();
    const hit = this.physics.rayDistance(
      { x: vPos.x, y: pivotY, z: vPos.z },
      { x: TMP_DIR.x, y: TMP_DIR.y, z: TMP_DIR.z },
      this.dist + 0.4,
      v.getBody(),
    );
    const clamped = hit !== null ? Math.max(1.2, hit - 0.35) : this.dist;
    this.smoothDist = damp(this.smoothDist, clamped, this.reducedMotion ? 60 : 18, dt);
    ORBIT_POS.set(
      vPos.x + TMP_DIR.x * this.smoothDist,
      pivotY + TMP_DIR.y * this.smoothDist,
      vPos.z + TMP_DIR.z * this.smoothDist,
    );

    // cockpit: seat anchor rotated by vehicle yaw (horizon stays level)
    const eye = v.getEyeOffset();
    COCKPIT_POS.set(eye.x, eye.y, eye.z).applyAxisAngle(WORLD_UP, v.getYaw()).add(vPos);

    if (this.fpDrive > 0.02) {
      const blend = clamp((this.fpDrive - 0.02) / 0.98, 0, 1);
      this.camera.position.lerpVectors(ORBIT_POS, COCKPIT_POS, blend);
    } else {
      this.camera.position.copy(ORBIT_POS);
    }

    if (this.fpDrive > 0.5) {
      this.camera.rotation.set(this.pitch * 0.7, this.yaw, 0);
    } else {
      this.camera.lookAt(vPos.x + TMP_LOOK.x * 3, pivotY + TMP_LOOK.y * 3, vPos.z + TMP_LOOK.z * 3);
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

