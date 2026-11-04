import * as THREE from 'three';
import { CITY } from '../config/gameConfig';
import type { GameBootContext, GameSystems } from '../engine/GameManager';
import { InputManager } from '../engine/InputManager';
import { CameraManager } from '../engine/CameraManager';
import { CharacterController } from '../engine/CharacterController';
import { AudioManager } from '../engine/AudioManager';
import { PhysicsManager } from '../engine/PhysicsManager';
import type { QualityPreset } from '../engine/quality';
import { generateCity, type CityData } from './city/CityGenerator';
import { WorldManager } from './WorldManager';
import { createMinimapDrawer } from './minimap';
import { ZONE_DEFS, zoneAt } from './city/zones';
import type { GameSettings, HudState } from '../state/store';
import { drawMinimap, registerMinimapDrawer } from '../state/minimapRegistry';
import { getState } from '../state/store';
import { VehicleManager } from './vehicles/VehicleManager';
import type { Vehicle } from './vehicles/Vehicle';

export interface BlocksideHooks {
  getSettings: () => GameSettings;
  getQualityPreset: () => QualityPreset;
  onHud: (patch: Partial<HudState>) => void;
  onZoneChange: (label: string) => void;
  onLockChange: (locked: boolean) => void;
  onEscape: () => void;
}

/**
 * BLOCKSIDE composition root: owns every engine system for one session and
 * implements the GameSystems contract consumed by GameManager.
 */
export class BlocksideGame implements GameSystems {
  camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private physics = new PhysicsManager();
  private input = new InputManager();
  private audio = new AudioManager();
  private world!: WorldManager;
  private player!: CharacterController;
  private cam!: CameraManager;
  private cityData: CityData;
  private marker = { x: 0, z: 0, yaw: 0 };
  private hudTimer = 0;
  private currentZone = '';
  private hooks: BlocksideHooks;
  private reducedMotion: boolean;
  private vehicles!: VehicleManager;

  constructor(hooks: BlocksideHooks, reducedMotion: boolean) {
    this.hooks = hooks;
    this.reducedMotion = reducedMotion;
    this.cityData = generateCity(1337);
  }

  /** Called once by GameManager.start before the first frame. */
  async build(ctx: GameBootContext): Promise<BlocksideGame> {
    this.scene = ctx.scene;
    await this.physics.init();

    const preset = this.hooks.getQualityPreset();
    this.world = new WorldManager(this.scene, this.cityData);
    this.world.applyQuality(preset);

    const spawn = this.cityData.spawn;
    this.player = new CharacterController(this.physics, spawn, this.reducedMotion);
    this.scene.add(this.player.group);

    this.cam = new CameraManager(
      Math.max(1, ctx.domElement.clientWidth) / Math.max(1, ctx.domElement.clientHeight),
      this.physics,
    );
    this.camera = this.cam.camera;
    this.cam.reducedMotion = this.reducedMotion;
    this.cam.setSpawn(spawn.yaw);
    this.cam.setFar(preset.cameraFar);

    // ---- vehicles (Phase 3) ----
    this.vehicles = new VehicleManager(this.physics, this.scene, this.audio, this.cityData, {
      onPrompt: (text) => this.hooks.onHud({ prompt: text }),
      onHudVehicle: (vehicle) => this.hooks.onHud({ vehicle }),
      onEnter: (vehicle: Vehicle) => {
        this.player.disableForVehicle();
        this.cam.setDriving(vehicle);
        this.audio.engineStart();
      },
      onExit: (_vehicle: Vehicle, pos, yaw) => {
        this.cam.setDriving(null);
        this.cam.setSpawn(yaw);
        this.player.enableFromVehicle(pos, yaw);
        this.audio.engineStop();
        this.hooks.onHud({ vehicle: null });
      },
    });

    // ---- static collision: ground, boundary walls, every building ----
    this.physics.addStaticBox({ x: 0, y: -0.5, z: 0 }, { x: 1800, y: 0.5, z: 1800 });
    const B = CITY.bound;
    const wallH = 5;
    this.physics.addStaticBox({ x: -B - 0.5, y: wallH / 2, z: 0 }, { x: 0.5, y: wallH, z: B + 30 });
    this.physics.addStaticBox({ x: B + 0.5, y: wallH / 2, z: 0 }, { x: 0.5, y: wallH, z: B + 30 });
    this.physics.addStaticBox({ x: 0, y: wallH / 2, z: -B - 0.5 }, { x: B + 30, y: wallH, z: 0.5 });
    this.physics.addStaticBox({ x: 0, y: wallH / 2, z: B + 0.5 }, { x: B + 30, y: wallH, z: 0.5 });
    for (const b of this.cityData.buildings) {
      this.physics.addStaticBox(
        { x: b.x, y: b.h / 2, z: b.z },
        { x: b.w / 2, y: b.h / 2, z: b.d / 2 },
      );
    }

    // ---- input ----
    this.input.attach(ctx.domElement);
    this.input.onLockChange = (locked) => this.hooks.onLockChange(locked);
    this.input.onEscape = () => this.hooks.onEscape();

    // ---- audio ----
    const settings = this.hooks.getSettings();
    this.audio.setVolume(settings.masterVolume);
    this.audio.setMusicOn(settings.musicOn);
    this.cam.sens = settings.sensitivity;
    this.cam.invertY = settings.invertY;

    // ---- minimap ----
    this.marker.x = spawn.x;
    this.marker.z = spawn.z;
    this.marker.yaw = spawn.yaw;
    registerMinimapDrawer(createMinimapDrawer(this.cityData, this.marker));

    // ---- test/debug hook (harmless in production, used by e2e) ----
    (window as unknown as { __BLOCKSIDE_DEBUG__?: unknown }).__BLOCKSIDE_DEBUG__ = {
      getPosition: () =>
        (this.vehicles.isDriving()
          ? this.vehicles.getActive()!.getPosition()
          : this.player.position
        ).toArray(),
      getVehicleState: () => this.vehicles.getVehicleState(),
      getPrompt: () => getState().hud.prompt,
      debugTeleport: (x: number, z: number) => {
        if (!this.vehicles.isDriving()) this.player.teleport(x, z);
      },
    };

    // ---- HUD seed ----
    this.currentZone = ZONE_DEFS[zoneAt(spawn.x, spawn.z)].label;
    this.hooks.onHud({ zone: this.currentZone, clock: this.world.clockString() });
    return this;
  }

  /** Per-frame tick, driven by GameManager. */
  update(dt: number, _elapsed: number): void {
    const look = this.input.consumeLook();
    if (look.dx !== 0 || look.dy !== 0) this.cam.applyLook(look.dx, look.dy);
    const wheel = this.input.consumeWheel();
    if (wheel !== 0) this.cam.zoom(wheel);
    if (this.input.wasPressed('cameraMode')) this.cam.toggleMode();
    const interact = this.input.wasPressed('interact');

    // vehicles apply their forces BEFORE the physics step…
    this.vehicles.update(dt, this.input, this.player.position, interact);
    this.physics.step(dt);
    // …and sync visuals/damage/resets AFTER it.
    this.vehicles.postStep(dt);

    const driving = this.vehicles.isDriving();
    if (!driving) {
      this.player.update(dt, this.input, this.cam.yaw);
      this.player.setVisible(!this.cam.firstPerson);
    }

    const focus = driving ? this.vehicles.getActive()!.getPosition() : this.player.position;
    this.cam.update(dt, this.player.position, this.player.rigidBody);

    this.world.update(dt, focus);
    this.marker.x = focus.x;
    this.marker.z = focus.z;
    this.marker.yaw = this.cam.yaw;
    drawMinimap();

    this.hudTimer += dt;
    if (this.hudTimer >= 0.25) {
      this.hudTimer = 0;
      const zone = ZONE_DEFS[zoneAt(focus.x, focus.z)];
      if (zone.label !== this.currentZone) {
        this.currentZone = zone.label;
        this.hooks.onHud({ zone: zone.label });
        this.hooks.onZoneChange(zone.label);
      }
      this.hooks.onHud({ clock: this.world.clockString() });
    }

    this.input.postUpdate();
  }

  /** Notification path when settings change mid-session. */
  applySettings(s: GameSettings): void {
    this.audio.setVolume(s.masterVolume);
    this.audio.setMusicOn(s.musicOn);
    this.cam.sens = s.sensitivity;
    this.cam.invertY = s.invertY;
  }

  startAudio(): void {
    this.audio.resume();
  }

  setSuspended(suspended: boolean): void {
    if (suspended) this.audio.suspend();
    else this.audio.resume();
  }

  requestLock(): void {
    this.input.requestLock();
  }

  releaseLock(): void {
    this.input.exitLock();
  }

  onQualityChanged(preset: QualityPreset): void {
    this.world.applyQuality(preset);
    this.cam.setFar(preset.cameraFar);
  }

  onResized(aspect: number): void {
    this.cam.setAspect(aspect);
  }

  dispose(): void {
    registerMinimapDrawer(null);
    this.input.detach();
    this.audio.dispose();
    this.vehicles.dispose();
    this.world.dispose();
    this.physics.dispose();
  }
}
