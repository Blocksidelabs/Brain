import * as THREE from 'three';
import type { CityData } from '../city/CityGenerator';
import type { AudioManager } from '../../engine/AudioManager';
import type { InputManager } from '../../engine/InputManager';
import type { PhysicsManager } from '../../engine/PhysicsManager';
import type { VehicleHud } from '../../state/store';
import { computeDrivetrain, rpmNorm, validateSpawn, VEHICLE_SPAWNS } from './vehicleTypes';
import { disposeVehicleTemplates } from './vehicleModels';
import { Vehicle, type DrivingInput } from './Vehicle';

const UPV = new THREE.Vector3(0, 1, 0);
const ENTER_RANGE = 3.4; // meters from vehicle center to allow entering
const EXIT_MAX_SPEED = 6; // m/s (~22 km/h) — slow down before exiting
const HUD_INTERVAL = 0.1;

export interface VehicleManagerHooks {
  onPrompt: (text: string | null) => void;
  onHudVehicle: (hud: VehicleHud | null) => void;
  onEnter: (vehicle: Vehicle) => void;
  onExit: (vehicle: Vehicle, pos: { x: number; y: number; z: number }, yaw: number) => void;
}

/**
 * Owns every vehicle in the world: spawning on validated roadside positions,
 * enter/exit interaction, driving input routing, driving HUD data and the
 * procedural engine/skid audio bridge.
 */
export class VehicleManager {
  private vehicles: Vehicle[] = [];
  private active: Vehicle | null = null;
  private physics: PhysicsManager;
  private scene: THREE.Scene;
  private audio: AudioManager;
  private hooks: VehicleManagerHooks;
  private hudTimer = 0;
  private skidTimer = 0;
  private lastPrompt: string | null = null;

  constructor(
    physics: PhysicsManager,
    scene: THREE.Scene,
    audio: AudioManager,
    cityData: CityData,
    hooks: VehicleManagerHooks,
  ) {
    this.physics = physics;
    this.scene = scene;
    this.audio = audio;
    this.hooks = hooks;
    for (const sp of VEHICLE_SPAWNS) {
      if (!validateSpawn(cityData, sp.x, sp.z)) {
        console.warn(
          `[BLOCKSIDE] vehicle spawn rejected (overlaps a building): ${sp.kind} @ ${sp.x},${sp.z}`,
        );
        continue;
      }
      const vehicle = new Vehicle(sp.kind, physics, sp.x, sp.z, sp.yaw, {
        onImpact: (severity) => {
          if (this.active === vehicle && severity > 5.5) this.audio.thud();
        },
      });
      scene.add(vehicle.model.root);
      this.vehicles.push(vehicle);
    }
  }

  isDriving(): boolean {
    return this.active !== null;
  }

  getActive(): Vehicle | null {
    return this.active;
  }

  getVehicleState(): {
    driving: boolean;
    name: string | null;
    speedKmh: number;
    condition: number;
  } {
    const v = this.active;
    return {
      driving: v !== null,
      name: v ? v.spec.name : null,
      speedKmh: v ? v.getSpeedKmh() : 0,
      condition: v ? v.getCondition() : 100,
    };
  }

  /**
   * Per-frame update BEFORE the physics step: builds the driving input,
   * runs vehicle control (forces) and handles enter/exit interaction.
   */
  update(
    dt: number,
    input: InputManager,
    playerPos: THREE.Vector3,
    interactPressed: boolean,
  ): void {
    if (this.active) {
      const drivingInput: DrivingInput = {
        throttle: (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 1 : 0),
        steer: (input.isDown('left') ? 1 : 0) - (input.isDown('right') ? 1 : 0),
        handbrake: input.isDown('jump'),
        nitro: input.isDown('sprint'),
      };
      this.active.control(dt, drivingInput);
      this.updateDrivingExtras(dt, drivingInput, interactPressed);
    } else {
      for (const v of this.vehicles) v.control(dt, null);
      this.updateProximity(playerPos, interactPressed);
    }
    this.pushDrivingHud(dt);
  }

  private updateDrivingExtras(dt: number, input: DrivingInput, interactPressed: boolean): void {
    const v = this.active!;
    const kmh = v.getSpeedKmh();
    const { rpm } = computeDrivetrain(kmh, input.throttle, v.getReversing());
    this.audio.engineUpdate(rpmNorm(rpm), Math.max(0, input.throttle));

    this.skidTimer += dt;
    const skid = v.getSkidLevel();
    if (skid > 0.05 && this.skidTimer > 0.15) {
      this.skidTimer = 0;
      this.audio.skid(skid);
    }

    const speed = v.speedMps();
    if (speed > EXIT_MAX_SPEED) {
      this.setPrompt('SLOW DOWN TO EXIT');
    } else {
      this.setPrompt('E — EXIT');
      if (interactPressed) this.exit();
    }
  }

  private updateProximity(playerPos: THREE.Vector3, interactPressed: boolean): void {
    let best: Vehicle | null = null;
    let bestDist = ENTER_RANGE;
    for (const v of this.vehicles) {
      const dx = v.getPosition().x - playerPos.x;
      const dz = v.getPosition().z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = v;
      }
    }
    this.setPrompt(best ? `E — ENTER ${best.spec.name}` : null);
    if (best && interactPressed) this.enter(best);
  }

  private enter(vehicle: Vehicle): void {
    this.active = vehicle;
    this.audio.engineStart();
    this.setPrompt('E — EXIT');
    this.hooks.onEnter(vehicle);
  }

  /** Exit through the first clear door; falls back to behind the vehicle. */
  private exit(): void {
    const v = this.active;
    if (!v) return;
    this.active = null;
    this.audio.engineStop();

    const pos = v.getPosition();
    const yaw = v.getYaw();
    const q = new THREE.Quaternion().setFromAxisAngle(UPV, yaw);
    const candidates: Array<[number, number]> = [
      [-1.9, 0.4], // left front door
      [1.9, 0.4], // right front door
      [0, 3.2], // directly behind
      [-1.9, -0.4],
      [1.9, -0.4],
    ];
    let out: { x: number; y: number; z: number } | null = null;
    let outYaw = yaw;
    for (const [ox, oz] of candidates) {
      const off = new THREE.Vector3(ox, 0, oz).applyQuaternion(q);
      const wx = pos.x + off.x;
      const wz = pos.z + off.z;
      // ground must exist right there…
      const ground = this.physics.rayDistance(
        { x: wx, y: pos.y + 1.5, z: wz },
        { x: 0, y: -1, z: 0 },
        4,
      );
      // …and the path out must be clear of obstacles (excluding the car)
      const len = Math.hypot(off.x, off.z) + 0.7;
      const inv = 1 / Math.max(1e-5, Math.hypot(off.x, off.z));
      const blocked = this.physics.rayDistance(
        { x: pos.x, y: pos.y + 0.9, z: pos.z },
        { x: off.x * inv, y: 0, z: off.z * inv },
        len,
        v.getBody(),
      );
      if (ground !== null && blocked === null) {
        out = { x: wx, y: 0.05, z: wz };
        outYaw = Math.atan2(-off.x * inv, -off.z * inv); // face outward
        break;
      }
    }
    if (!out) out = { x: pos.x, y: 0.05, z: pos.z + 3.2 };
    this.setPrompt(null);
    this.hooks.onHudVehicle(null);
    this.hooks.onExit(v, out, outYaw);
  }

  private setPrompt(text: string | null): void {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    this.hooks.onPrompt(text);
  }

  private pushDrivingHud(dt: number): void {
    this.hudTimer += dt;
    if (this.hudTimer < HUD_INTERVAL || !this.active) return;
    this.hudTimer = 0;
    const v = this.active;
    const kmh = v.getSpeedKmh();
    const drivetrain = computeDrivetrain(kmh, v.getThrottle(), v.getReversing());
    const hud: VehicleHud = {
      name: v.spec.name,
      speedKmh: kmh,
      gear: drivetrain.gear,
      rpm: drivetrain.rpm,
      fuel: v.getFuel(),
      condition: v.getCondition(),
      handbrake: v.getHandbrake(),
      nitroLocked: true,
    };
    this.hooks.onHudVehicle(hud);
  }

  /** Called AFTER the physics step for every vehicle (visual sync, damage, resets). */
  postStep(dt: number): void {
    for (const v of this.vehicles) v.postStep(dt);
  }

  dispose(): void {
    for (const v of this.vehicles) v.removeFromScene(this.scene);
    this.vehicles = [];
    this.active = null;
    disposeVehicleTemplates();
  }
}
