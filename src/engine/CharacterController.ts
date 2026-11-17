import * as THREE from 'three';
import { PLAYER } from '../config/gameConfig';
import { damp, dampAngle } from './mathUtils';
import type { CharacterActor, PhysicsManager } from './PhysicsManager';
import type { InputManager } from './InputManager';

export type CharacterState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch';

const TMP_WISH = new THREE.Vector3();
const TMP_MOVE = new THREE.Vector3();

/**
 * Third-person playable character: Rapier kinematic body + character
 * controller for collision, camera-relative movement, and a small set of
 * procedural animation states (idle/walk/run/jump/fall/crouch).
 */
export class CharacterController {
  readonly group = new THREE.Group();
  private actor: CharacterActor;
  private velX = 0;
  private velZ = 0;
  private vy = 0;
  private yaw: number;
  private grounded = false;
  private state: CharacterState = 'idle';
  private phase = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private reducedMotion: boolean;
  private pos = new THREE.Vector3();

  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  private visor: THREE.Mesh;
  private hips: THREE.Mesh;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private elbowL: THREE.Group;
  private elbowR: THREE.Group;
  private kneeL: THREE.Group;
  private kneeR: THREE.Group;
  private poseSwing = 0;
  private poseCrouch = 0;
  private idleT = 0;

  constructor(
    physics: PhysicsManager,
    spawn: { x: number; z: number; yaw: number },
    reducedMotion: boolean,
  ) {
    this.reducedMotion = reducedMotion;
    this.yaw = spawn.yaw;
    this.actor = physics.createCharacter(spawn.x, 0.05, spawn.z);
    this.pos.set(spawn.x, 0.05, spawn.z);

    const jacket = new THREE.MeshStandardMaterial({ color: 0x1b1e2c, roughness: 0.72 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd8a37a, roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3245, roughness: 0.85 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x101218, roughness: 0.7 });
    const shirt = new THREE.MeshStandardMaterial({
      color: 0x35e0ff,
      emissive: 0x35e0ff,
      emissiveIntensity: 0.22,
      roughness: 0.8,
    });

    const add = (mesh: THREE.Mesh, parent: THREE.Object3D): THREE.Mesh => {
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // torso: chest + hips + neck (broader shoulders, flatter chest)
    this.torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), jacket), this.group);
    this.torso.position.y = 1.18;
    this.torso.scale.set(1.15, 1, 0.8);
    this.hips = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.14, 4, 8), jeans), this.group);
    this.hips.position.y = 0.86;
    const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.1, 8), skin), this.group);
    neck.position.y = 1.5;
    const shirtPanel = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.06), shirt), this.group);
    shirtPanel.position.set(0, 1.18, -0.17);
    const belt = add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.3), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 })), this.group);
    belt.position.y = 0.98;

    // head + hair + sunglasses (hair/visor parented to the head)
    this.head = add(new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), skin), this.group);
    this.head.position.y = 1.66;
    this.head.scale.set(0.95, 1.05, 1);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.set(0, 0.05, 0.02);
    this.head.add(hairCap);
    this.visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.05), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2 }));
    this.visor.position.set(0, 0.02, -0.13);
    this.head.add(this.visor);

    // arms: shoulder → upper arm → elbow → forearm → hand
    const upperArmGeo = new THREE.CapsuleGeometry(0.062, 0.3, 4, 8);
    upperArmGeo.translate(0, -0.17, 0);
    const foreArmGeo = new THREE.CapsuleGeometry(0.055, 0.26, 4, 8);
    foreArmGeo.translate(0, -0.16, 0);
    const makeArm = (sx: number): { shoulder: THREE.Group; elbow: THREE.Group } => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 0.31, 1.42, 0);
      shoulder.rotation.z = sx * -0.1;
      add(new THREE.Mesh(upperArmGeo, jacket), shoulder);
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.36, 0);
      add(new THREE.Mesh(foreArmGeo, skin), elbow);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skin);
      hand.position.set(0, -0.34, 0);
      elbow.add(hand);
      shoulder.add(elbow);
      this.group.add(shoulder);
      return { shoulder, elbow };
    };
    const armLPair = makeArm(1);
    this.armL = armLPair.shoulder;
    this.elbowL = armLPair.elbow;
    const armRPair = makeArm(-1);
    this.armR = armRPair.shoulder;
    this.elbowR = armRPair.elbow;

    // legs: hip → thigh → knee → shin → shoe
    const thighGeo = new THREE.CapsuleGeometry(0.085, 0.34, 4, 8);
    thighGeo.translate(0, -0.2, 0);
    const shinGeo = new THREE.CapsuleGeometry(0.07, 0.32, 4, 8);
    shinGeo.translate(0, -0.19, 0);
    const makeLeg = (sx: number): { hip: THREE.Group; knee: THREE.Group } => {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.12, 0.92, 0);
      add(new THREE.Mesh(thighGeo, jeans), hip);
      const knee = new THREE.Group();
      knee.position.set(0, -0.42, 0);
      add(new THREE.Mesh(shinGeo, jeans), knee);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.27), shoe);
      foot.position.set(0, -0.4, -0.05);
      knee.add(foot);
      hip.add(knee);
      this.group.add(hip);
      return { hip, knee };
    };
    const legLPair = makeLeg(1);
    this.legL = legLPair.hip;
    this.kneeL = legLPair.knee;
    const legRPair = makeLeg(-1);
    this.legR = legRPair.hip;
    this.kneeR = legRPair.knee;

    this.group.rotation.y = this.yaw;
  }

  get position(): THREE.Vector3 {
    return this.pos;
  }

  get yawAngle(): number {
    return this.yaw;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get currentState(): CharacterState {
    return this.state;
  }

  get rigidBody(): CharacterActor['body'] {
    return this.actor.body;
  }

  horizontalSpeed(): number {
    return Math.hypot(this.velX, this.velZ);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  /** Park the character while driving (body disabled, model hidden). */
  disableForVehicle(): void {
    this.actor.body.setEnabled(false);
    this.group.visible = false;
  }

  /** Restore the character at a world position after leaving a vehicle. */
  enableFromVehicle(pos: { x: number; y: number; z: number }, yaw: number): void {
    const y = Math.max(0.05, pos.y);
    this.actor.body.setEnabled(true);
    this.actor.body.setTranslation({ x: pos.x, y, z: pos.z }, true);
    this.vy = 0;
    this.velX = 0;
    this.velZ = 0;
    this.grounded = true;
    this.yaw = yaw;
    this.pos.set(pos.x, y, pos.z);
    this.group.position.copy(this.pos);
    this.group.rotation.y = yaw;
    this.group.visible = true;
  }

  /** Test/debug helper: instant reposition (used by the e2e suite). */
  teleport(x: number, z: number): void {
    this.actor.body.setTranslation({ x, y: 0.05, z }, true);
    this.pos.set(x, 0.05, z);
    this.group.position.set(x, 0.05, z);
    this.vy = 0;
  }

  /** One simulation tick: input -> velocity -> kinematic move -> animation. */
  update(dt: number, input: InputManager, camYaw: number): void {
    const fwd = (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 1 : 0);
    const strafe = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const wish = TMP_WISH.set(0, 0, 0);
    if (fwd !== 0 || strafe !== 0) {
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      wish.set(fx * fwd + rx * strafe, 0, fz * fwd + rz * strafe);
      if (wish.lengthSq() > 0) wish.normalize();
    }

    const crouching = input.isDown('crouch');
    const sprinting = input.isDown('sprint') && !crouching;
    const targetSpeed = crouching ? PLAYER.crouchSpeed : sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;

    const accel = this.grounded ? PLAYER.accelGround : PLAYER.accelAir;
    if (wish.lengthSq() > 0) {
      this.velX = damp(this.velX, wish.x * targetSpeed, accel, dt);
      this.velZ = damp(this.velZ, wish.z * targetSpeed, accel, dt);
    } else {
      const decel = this.grounded ? 12 : 1.2;
      this.velX = damp(this.velX, 0, decel, dt);
      this.velZ = damp(this.velZ, 0, decel, dt);
    }

    if (input.wasPressed('jump')) this.jumpBuffer = 0.12;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = PLAYER.jumpSpeed;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
    }
    if (!this.grounded) this.vy -= PLAYER.gravity * dt;

    const t = this.actor.body.translation();
    TMP_MOVE.set(this.velX * dt, this.grounded ? -0.02 : this.vy * dt, this.velZ * dt);
    this.actor.controller.computeColliderMovement(this.actor.collider, TMP_MOVE);
    const corrected = this.actor.controller.computedMovement();
    const nx = t.x + corrected.x;
    const ny = t.y + corrected.y;
    const nz = t.z + corrected.z;
    this.actor.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    this.grounded = this.actor.controller.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;
    this.pos.set(nx, ny, nz);

    const speedH = Math.hypot(this.velX, this.velZ);
    if (speedH > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(-this.velX, -this.velZ), 12, dt);

    let st: CharacterState;
    if (crouching && this.grounded) st = 'crouch';
    else if (!this.grounded) st = this.vy > 0.5 ? 'jump' : 'fall';
    else st = speedH > 5.5 ? 'run' : speedH > 0.4 ? 'walk' : 'idle';
    this.state = st;

    this.group.position.set(nx, ny, nz);
    this.group.rotation.y = this.yaw;
    this.animate(dt, speedH, sprinting, crouching);
  }

  private animate(dt: number, speedH: number, sprinting: boolean, crouching: boolean): void {
    this.idleT += dt;
    this.poseCrouch = damp(this.poseCrouch, crouching ? 1 : 0, 12, dt);
    const moving = speedH > 0.4;
    if (moving && !this.reducedMotion) this.phase += speedH * dt * 1.9;
    const swing = moving ? Math.sin(this.phase) * (sprinting ? 0.82 : 0.52) : 0;
    this.poseSwing = damp(this.poseSwing, swing, 18, dt);
    const bob = moving && !this.reducedMotion ? Math.abs(Math.sin(this.phase)) * 0.05 : 0;
    const drop = this.poseCrouch * 0.34;
    const breathe = Math.sin(this.idleT * 2.1) * 0.012;

    this.torso.position.y = 1.18 - drop + bob * 0.6 + (moving ? 0 : breathe);
    this.torso.rotation.x =
      damp(this.torso.rotation.x, moving ? (sprinting ? 0.24 : 0.1) : 0, 10, dt) + this.poseCrouch * 0.35;
    this.hips.position.y = 0.86 - drop + bob * 0.6;
    this.head.position.y = 1.66 - drop * 1.1 + bob * 0.6;

    if (this.grounded) {
      const legSwing = this.poseSwing * 0.95;
      this.legL.rotation.x = damp(this.legL.rotation.x, -legSwing - this.poseCrouch, 16, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, legSwing - this.poseCrouch, 16, dt);
      const bendL = 0.06 + Math.max(0, Math.sin(this.phase)) * 0.8 + this.poseCrouch * 1.6;
      const bendR = 0.06 + Math.max(0, -Math.sin(this.phase)) * 0.8 + this.poseCrouch * 1.6;
      this.kneeL.rotation.x = damp(this.kneeL.rotation.x, bendL, 16, dt);
      this.kneeR.rotation.x = damp(this.kneeR.rotation.x, bendR, 16, dt);
      this.armL.rotation.x = damp(this.armL.rotation.x, this.poseSwing * 0.85 + this.poseCrouch * 0.4, 16, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, -this.poseSwing * 0.85 + this.poseCrouch * 0.4, 16, dt);
      this.elbowL.rotation.x = damp(this.elbowL.rotation.x, -0.28 - Math.abs(this.poseSwing) * 0.5, 16, dt);
      this.elbowR.rotation.x = damp(this.elbowR.rotation.x, -0.28 - Math.abs(this.poseSwing) * 0.5, 16, dt);
    } else {
      this.legL.rotation.x = damp(this.legL.rotation.x, -0.55, 10, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, 0.15, 10, dt);
      this.kneeL.rotation.x = damp(this.kneeL.rotation.x, 1.25, 10, dt);
      this.kneeR.rotation.x = damp(this.kneeR.rotation.x, 0.45, 10, dt);
      this.armL.rotation.x = damp(this.armL.rotation.x, -0.85, 10, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, -0.85, 10, dt);
      this.elbowL.rotation.x = damp(this.elbowL.rotation.x, -0.7, 10, dt);
      this.elbowR.rotation.x = damp(this.elbowR.rotation.x, -0.7, 10, dt);
    }

    if (!moving && this.grounded) {
      const sway = Math.sin(this.idleT * 1.6) * 0.035;
      this.armL.rotation.z = 0.06 + sway;
      this.armR.rotation.z = -0.06 - sway;
      this.torso.rotation.z = sway * 0.4;
    } else {
      this.armL.rotation.z = damp(this.armL.rotation.z, 0, 8, dt);
      this.armR.rotation.z = damp(this.armR.rotation.z, 0, 8, dt);
      this.torso.rotation.z = damp(this.torso.rotation.z, 0, 8, dt);
    }
  }
}
