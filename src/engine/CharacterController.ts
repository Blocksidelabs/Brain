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
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private poseSwing = 0;
  private poseCrouch = 0;

  constructor(
    physics: PhysicsManager,
    spawn: { x: number; z: number; yaw: number },
    reducedMotion: boolean,
  ) {
    this.reducedMotion = reducedMotion;
    this.yaw = spawn.yaw;
    this.actor = physics.createCharacter(spawn.x, 0.05, spawn.z);
    this.pos.set(spawn.x, 0.05, spawn.z);

    const jacket = new THREE.MeshStandardMaterial({ color: 0x1b1e2c, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd8a37a, roughness: 0.6 });
    const neon = new THREE.MeshStandardMaterial({
      color: 0x0a2030,
      emissive: 0x35e0ff,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x232b3a, roughness: 0.8 });

    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.62, 4, 8), jacket);
    this.torso.position.y = 1.02;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), skin);
    this.head.position.y = 1.66;
    this.visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.14), neon);
    this.visor.position.set(0, 1.66, -0.14);

    const armGeo = new THREE.CapsuleGeometry(0.07, 0.5, 4, 8);
    armGeo.translate(0, -0.3, 0);
    this.armL = new THREE.Mesh(armGeo, jacket);
    this.armL.position.set(0.36, 1.4, 0);
    this.armL.rotation.z = 0.12;
    this.armR = new THREE.Mesh(armGeo, jacket);
    this.armR.position.set(-0.36, 1.4, 0);
    this.armR.rotation.z = -0.12;

    const legGeo = new THREE.CapsuleGeometry(0.09, 0.55, 4, 8);
    legGeo.translate(0, -0.35, 0);
    this.legL = new THREE.Mesh(legGeo, jeans);
    this.legL.position.set(0.13, 0.88, 0);
    this.legR = new THREE.Mesh(legGeo, jeans);
    this.legR.position.set(-0.13, 0.88, 0);

    for (const m of [this.torso, this.head, this.visor, this.armL, this.armR, this.legL, this.legR]) {
      m.castShadow = true;
    }
    this.group.add(this.torso, this.head, this.visor, this.armL, this.armR, this.legL, this.legR);
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
    this.poseCrouch = damp(this.poseCrouch, crouching ? 1 : 0, 12, dt);
    const moving = speedH > 0.4;
    if (moving && !this.reducedMotion) this.phase += speedH * dt * 1.9;
    const swing = moving ? Math.sin(this.phase) * (sprinting ? 0.85 : 0.55) : 0;
    this.poseSwing = damp(this.poseSwing, swing, 18, dt);
    const bob = moving && !this.reducedMotion ? Math.abs(Math.sin(this.phase)) * 0.05 : 0;
    const drop = this.poseCrouch * 0.34;

    this.torso.position.y = 1.02 - drop + bob;
    this.torso.rotation.x = damp(this.torso.rotation.x, moving ? (sprinting ? 0.18 : 0.08) : 0, 10, dt);
    this.head.position.y = 1.66 - drop * 1.15 + bob;
    this.visor.position.y = this.head.position.y;
    this.visor.position.z = -0.14 - this.poseCrouch * 0.04;

    if (this.grounded) {
      this.armL.rotation.x = this.poseSwing;
      this.armR.rotation.x = -this.poseSwing;
      this.legL.rotation.x = -this.poseSwing * 0.9;
      this.legR.rotation.x = this.poseSwing * 0.9;
    } else {
      this.armL.rotation.x = damp(this.armL.rotation.x, -0.7, 10, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, -0.7, 10, dt);
      this.legL.rotation.x = damp(this.legL.rotation.x, 0.45, 10, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, -0.25, 10, dt);
    }
  }
}
