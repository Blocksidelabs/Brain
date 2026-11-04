import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { clamp, damp } from '../../engine/mathUtils';
import type { PhysicsManager } from '../../engine/PhysicsManager';
import { instantiateVehicleModel, type VehicleModel } from './vehicleModels';
import { VEHICLE_SPECS, type VehicleKind, type VehicleSpec } from './vehicleTypes';

export interface DrivingInput {
  /** +1 accelerate, -1 brake/reverse */
  throttle: number;
  /** +1 left, -1 right */
  steer: number;
  handbrake: boolean;
  nitro: boolean;
}

export interface VehicleEvents {
  /** severity ~ delta-v of a hard impact (m/s), used for damage + audio */
  onImpact: (severity: number) => void;
}

const G = 9.81;
const UP = new THREE.Vector3(0, 1, 0);

// module-level scratch (single-threaded frame use)
const Q = new THREE.Quaternion();
const STEER_Q = new THREE.Quaternion();
const V_POS = new THREE.Vector3();
const V_UP = new THREE.Vector3();
const V_FWD = new THREE.Vector3();
const V_RIGHT = new THREE.Vector3();
const V_COM = new THREE.Vector3();
const V_ANCHOR = new THREE.Vector3();
const V_CONTACT = new THREE.Vector3();
const V_R = new THREE.Vector3();
const V_VEL = new THREE.Vector3();
const V_DIR = new THREE.Vector3();
const V_FWD_W = new THREE.Vector3();
const V_LAT_W = new THREE.Vector3();

/**
 * Raycast-suspension vehicle on a real Rapier dynamic rigid body.
 *
 * The JS bindings expose no vehicle controller, so this implements the
 * classic raycast-car model directly: one chassis body + four independent
 * suspension raycasts (spring/damper impulses at the anchors) + per-wheel
 * tire friction (lateral slip kill, longitudinal drive/brake) applied at
 * the ground contact points. Wheels are purely visual (positioned on the
 * ray, spun by contact velocity, steered on the front axle).
 */
export class Vehicle {
  readonly spec: VehicleSpec;
  readonly model: VehicleModel;
  readonly body: RAPIER.RigidBody;
  private physics: PhysicsManager;
  private events: VehicleEvents;
  private steer = 0;
  private compression = [0, 0, 0, 0];
  private hitDist: number[] = [0, 0, 0, 0];
  private grounded = [false, false, false, false];
  private load = [0, 0, 0, 0];
  private wheelFwdV = [0, 0, 0, 0];
  private throttleState = 0;
  private handbrakeState = false;
  private damage = 0;
  private fuel = 100;
  private overturnTimer = 0;
  private skidLevel = 0;
  private reversing = false;
  private prevVel = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private yaw = 0;

  constructor(
    kind: VehicleKind,
    physics: PhysicsManager,
    x: number,
    z: number,
    yaw: number,
    events: VehicleEvents,
  ) {
    this.physics = physics;
    this.events = events;
    this.spec = VEHICLE_SPECS[kind];
    this.model = instantiateVehicleModel(kind);
    const s = this.spec;
    const y = s.suspension.rest + 0.25; // drops onto its suspension at spawn
    this.body = physics.createVehicleBody(x, y, z, s.bodyHalf, s.colliderLift, s.mass);
    const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.pos.set(x, y, z);
    this.yaw = yaw;
    for (let i = 0; i < 4; i++) this.hitDist[i] = s.suspension.rest + s.wheelRadius;
  }

  /**
   * Called every frame BEFORE the physics step. `input === null` means the
   * vehicle is unoccupied (parked): suspension only, and skipped entirely
   * while Rapier has the body asleep (near-zero cost for parked cars).
   */
  control(dt: number, input: DrivingInput | null): void {
    const s = this.spec;
    this.skidLevel = 0;
    if (input) {
      const speedFactor = 1 / (1 + this.speedMps() * 0.035);
      this.steer = damp(this.steer, input.steer * s.steerMax * speedFactor, 9, dt);
      this.throttleState = input.throttle;
      this.handbrakeState = input.handbrake;
      this.fuel = Math.max(0, this.fuel - Math.max(0, input.throttle) * 0.12 * dt);
    } else {
      if (this.body.isSleeping()) return; // parked & settled — no physics work
      this.steer = damp(this.steer, 0, 4, dt);
      this.throttleState = 0;
      this.handbrakeState = false;
    }

    const t = this.body.translation();
    const rot = this.body.rotation();
    Q.set(rot.x, rot.y, rot.z, rot.w);
    V_POS.set(t.x, t.y, t.z);
    V_UP.set(0, 1, 0).applyQuaternion(Q);
    V_FWD.set(0, 0, -1).applyQuaternion(Q);
    V_RIGHT.set(1, 0, 0).applyQuaternion(Q);
    V_COM.set(0, s.colliderLift, 0).applyQuaternion(Q).add(V_POS);

    const linv = this.body.linvel();
    const angv = this.body.angvel();
    const maxToi = s.suspension.rest + s.wheelRadius;
    const anchorY = 0.04;

    for (let i = 0; i < 4; i++) {
      const lx = i % 2 === 0 ? -s.trackX : s.trackX;
      const lz = i < 2 ? -s.wheelBaseZ : s.wheelBaseZ;
      V_ANCHOR.set(lx, anchorY, lz).applyQuaternion(Q).add(V_POS);

      // velocity at the anchor (suspension damper needs it)
      V_R.copy(V_ANCHOR).sub(V_COM);
      V_VEL.set(
        linv.x + angv.y * V_R.z - angv.z * V_R.y,
        linv.y + angv.z * V_R.x - angv.x * V_R.z,
        linv.z + angv.x * V_R.y - angv.y * V_R.x,
      );

      V_DIR.copy(V_UP).negate();
      const hit = this.physics.rayDistance(
        { x: V_ANCHOR.x, y: V_ANCHOR.y, z: V_ANCHOR.z },
        { x: V_DIR.x, y: V_DIR.y, z: V_DIR.z },
        maxToi,
        this.body,
      );

      let compression = 0;
      if (hit !== null) {
        const d = Math.max(hit, s.wheelRadius * 0.4);
        compression = clamp(s.suspension.rest - (d - s.wheelRadius), 0, s.suspension.rest);
        this.hitDist[i] = d;
        this.grounded[i] = true;
      } else {
        this.hitDist[i] = maxToi;
        this.grounded[i] = false;
      }
      const springVel = (compression - this.compression[i]) / Math.max(dt, 1e-4);
      this.compression[i] = compression;
      this.load[i] = compression * s.suspension.stiffness;

      if (compression > 0) {
        const force = clamp(
          s.suspension.stiffness * compression + s.suspension.damping * springVel,
          0,
          s.suspension.maxForce,
        );
        const imp = force * dt;
        this.body.applyImpulseAtPoint(
          { x: V_UP.x * imp, y: V_UP.y * imp, z: V_UP.z * imp },
          { x: V_ANCHOR.x, y: V_ANCHOR.y, z: V_ANCHOR.z },
          true,
        );
      }

      if (!this.grounded[i]) {
        this.wheelFwdV[i] = 0;
        continue;
      }

      // ---- tire forces at the ground contact point ----
      V_CONTACT.copy(V_ANCHOR).addScaledVector(V_DIR, this.hitDist[i]);
      V_R.copy(V_CONTACT).sub(V_COM);
      V_VEL.set(
        linv.x + angv.y * V_R.z - angv.z * V_R.y,
        linv.y + angv.z * V_R.x - angv.x * V_R.z,
        linv.z + angv.x * V_R.y - angv.y * V_R.x,
      );

      const isFront = i < 2;
      STEER_Q.setFromAxisAngle(V_UP, isFront ? this.steer : 0);
      V_FWD_W.copy(V_FWD).applyQuaternion(STEER_Q);
      V_LAT_W.copy(V_RIGHT).applyQuaternion(STEER_Q);
      const latV = V_VEL.dot(V_LAT_W);
      const fwdV = V_VEL.dot(V_FWD_W);
      this.wheelFwdV[i] = fwdV;

      // lateral grip (handbrake unloads the rear axle -> drifts)
      const gripMul = this.handbrakeState && !isFront ? 0.35 : 1;
      const loadRatio = clamp(this.load[i] / ((s.mass * G) / 4), 0.15, 2.2);
      const maxFric = s.grip * gripMul * loadRatio * ((s.mass * G) / 4) * dt;
      const jL = clamp(-latV * (s.mass / 4) * 0.9 * gripMul, -maxFric, maxFric);
      this.body.applyImpulseAtPoint(
        { x: V_LAT_W.x * jL, y: V_LAT_W.y * jL, z: V_LAT_W.z * jL },
        { x: V_CONTACT.x, y: V_CONTACT.y, z: V_CONTACT.z },
        true,
      );
      if (Math.abs(latV) > 3.5) {
        this.skidLevel = Math.max(this.skidLevel, Math.min(1, (Math.abs(latV) - 3.5) / 4));
      }

      // longitudinal: drive / brake / rolling resistance
      let jF = 0;
      const nDriven = s.drive === 'all' ? 4 : 2;
      const driven = s.drive === 'all' || !isFront;
      const engineEff = 1 - (this.damage / 100) * 0.35;
      if (driven && this.throttleState > 0 && this.fuel > 0) {
        const falloff = clamp(1 - this.speedMps() / s.maxSpeed, 0, 1);
        jF += ((s.engineForce * engineEff * this.throttleState * falloff) / nDriven) * dt;
      }
      if (driven && this.throttleState < 0 && this.fuel > 0) {
        const rev = clamp(1 - Math.max(0, -fwdV) / s.reverseMaxSpeed, 0, 1);
        jF -= ((s.reverseForce * engineEff * -this.throttleState * rev) / nDriven) * dt;
      }
      let brakeF = 0;
      if (this.throttleState < 0 && fwdV > 0.6) brakeF += s.brakeForce / 4;
      if (this.throttleState > 0 && fwdV < -0.6) brakeF += s.brakeForce / 4;
      if (this.handbrakeState && !isFront) brakeF += 6000;
      if (brakeF > 0) {
        // clamp so a brake step can never reverse the wheel direction
        jF += -Math.sign(fwdV) * Math.min(brakeF * dt, Math.abs(fwdV) * (s.mass / 4));
      }
      if (Math.abs(fwdV) > 0.2) jF += -Math.sign(fwdV) * 25; // rolling resistance

      if (jF !== 0) {
        this.body.applyImpulseAtPoint(
          { x: V_FWD_W.x * jF, y: V_FWD_W.y * jF, z: V_FWD_W.z * jF },
          { x: V_CONTACT.x, y: V_CONTACT.y, z: V_CONTACT.z },
          true,
        );
      }
    }

    // explosion guard
    const av = this.body.angvel();
    const mag = Math.hypot(av.x, av.y, av.z);
    if (mag > 12) {
      const k = 12 / mag;
      this.body.setAngvel({ x: av.x * k, y: av.y * k, z: av.z * k }, true);
    }
  }

  /** Called AFTER the physics step: syncs visuals, detects impacts, handles resets. */
  postStep(dt: number): void {
    const t = this.body.translation();
    const rot = this.body.rotation();
    this.pos.set(t.x, t.y, t.z);
    Q.set(rot.x, rot.y, rot.z, rot.w);
    this.model.root.position.copy(this.pos);
    this.model.root.quaternion.copy(Q);
    V_UP.set(0, 1, 0).applyQuaternion(Q);
    V_FWD.set(0, 0, -1).applyQuaternion(Q);
    this.yaw = Math.atan2(-V_FWD.x, -V_FWD.z);
    const lv0 = this.body.linvel();
    this.reversing = V_FWD.x * lv0.x + V_FWD.z * lv0.z < -0.5;

    // damage foundation: impulse-style Δv detection (crashes show up as
    // sudden velocity changes; falling onto the suspension does not)
    const lv = this.body.linvel();
    V_VEL.set(lv.x, lv.y, lv.z);
    const dv = this.prevVel.distanceTo(V_VEL);
    if (dv > 4.5) {
      this.damage = Math.min(100, this.damage + (dv - 4.5) * 1.8);
      this.events.onImpact(dv);
    }
    this.prevVel.copy(V_VEL);

    // wheel visuals
    for (let i = 0; i < 4; i++) {
      const lx = i % 2 === 0 ? -this.spec.trackX : this.spec.trackX;
      const lz = i < 2 ? -this.spec.wheelBaseZ : this.spec.wheelBaseZ;
      const node = this.model.wheels[i];
      node.position.set(lx, 0.04 - (this.hitDist[i] - this.spec.wheelRadius), lz);
      if (i < 2) node.rotation.y = this.steer;
      const locked = this.handbrakeState && i >= 2;
      const spinRate = locked ? 0 : this.wheelFwdV[i] / this.spec.wheelRadius;
      this.model.spins[i].rotation.x -= spinRate * dt;
    }
    if (this.model.steeringWheel) this.model.steeringWheel.rotation.z = -this.steer * 2.6;

    // auto-reset when overturned (or fell out of the world)
    const speed = this.speedMps();
    if ((V_UP.y < 0.2 && speed < 1.5) || t.y < -4) {
      this.overturnTimer += dt;
      if (this.overturnTimer > 2.2) this.reset();
    } else {
      this.overturnTimer = 0;
    }
  }

  /** Upright the vehicle in place (used after being overturned). */
  reset(): void {
    const t = this.body.translation();
    const q = new THREE.Quaternion().setFromAxisAngle(UP, this.yaw);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setTranslation({ x: t.x, y: t.y + 1.4, z: t.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.overturnTimer = 0;
    this.damage = Math.min(100, this.damage + 2);
    for (let i = 0; i < 4; i++) {
      this.compression[i] = 0;
      this.hitDist[i] = this.spec.suspension.rest + this.spec.wheelRadius;
    }
  }

  speedMps(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.z);
  }

  getSpeedKmh(): number {
    return this.speedMps() * 3.6;
  }

  getCondition(): number {
    return 100 - this.damage;
  }

  getFuel(): number {
    return this.fuel;
  }

  getSteer(): number {
    return this.steer;
  }

  getThrottle(): number {
    return this.throttleState;
  }

  getSkidLevel(): number {
    return this.skidLevel;
  }

  getReversing(): boolean {
    return this.reversing;
  }

  getHandbrake(): boolean {
    return this.handbrakeState;
  }

  getPosition(): THREE.Vector3 {
    return this.pos;
  }

  getYaw(): number {
    return this.yaw;
  }

  getBody(): RAPIER.RigidBody {
    return this.body;
  }

  getEyeOffset(): { x: number; y: number; z: number } {
    return this.spec.eye;
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.model.root);
  }
}

