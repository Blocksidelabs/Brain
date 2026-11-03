import * as THREE from 'three';
import { DAYNIGHT } from '../config/gameConfig';
import { clamp } from '../engine/mathUtils';
import { disposeObject } from '../engine/dispose';
import type { QualityPreset } from '../engine/quality';
import type { CityData } from './city/CityGenerator';
import { buildCity, type CityBuild } from './city/CityBuilder';
import { makeGlowTexture } from './city/textures';

const NIGHT_SKY = new THREE.Color('#0a0c1e');
const DAY_SKY = new THREE.Color('#69b7e6');
const DUSK_SKY = new THREE.Color('#3a1440');
const NIGHT_FOG = new THREE.Color('#0a0c1e');
const DAY_FOG = new THREE.Color('#9fd0ea');
const DUSK_FOG = new THREE.Color('#c8501e');
const SUN_DAY = new THREE.Color('#fff2d8');
const SUN_SET = new THREE.Color('#ff8a4a');
const MOON_COLOR = new THREE.Color('#9db4ff');
const HEMI_NIGHT = new THREE.Color('#2c3654');
const HEMI_DAY = new THREE.Color('#bfd9ff');
const TMP_DIR = new THREE.Vector3();
const TMP_POS = new THREE.Vector3();

/** Owns sky, fog, lights, the day/night cycle and the built city. */
export class WorldManager {
  timeOfDay: number = DAYNIGHT.startHour;
  night = 0;
  private elapsed = 0;
  private scene: THREE.Scene;
  private fog: THREE.FogExp2;
  private baseFogDensity = 0.003;
  private cityBuild: CityBuild;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sunTarget = new THREE.Object3D();
  private stars: THREE.Points;
  private sunSprite: THREE.Sprite;
  private moonSprite: THREE.Sprite;

  constructor(scene: THREE.Scene, data: CityData) {
    this.scene = scene;
    this.fog = new THREE.FogExp2(0x0a0c1e, this.baseFogDensity);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0x0a0c1e);

    this.cityBuild = buildCity(data);
    scene.add(this.cityBuild.group);

    this.hemi = new THREE.HemisphereLight(HEMI_DAY.getHex(), 0x3a2438, 0.5);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 420;
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.5;
    scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;

    const starCount = 700;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 0.95);
      positions[i * 3] = 700 * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = 700 * Math.cos(phi) + 30;
      positions[i * 3 + 2] = 700 * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        size: 2.2,
        map: makeGlowTexture('#ffffff'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture('#ffe9b0', '#ff9a3c'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.sunSprite.scale.setScalar(140);
    this.moonSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture('#e6ecff', '#8fa5d8'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.moonSprite.scale.setScalar(80);
    scene.add(this.sunSprite, this.moonSprite);
  }

  /** Advance the day/night cycle, drive lights and the city's emissive systems. */
  update(dt: number, playerPos: THREE.Vector3): void {
    this.timeOfDay = (this.timeOfDay + (dt * 24) / DAYNIGHT.cycleSeconds) % 24;
    this.elapsed += dt;

    const ang = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunH = Math.sin(ang);
    const day = clamp(sunH * 2.2 + 0.08, 0, 1);
    const night = 1 - clamp((sunH + 0.14) * 3.6, 0, 1);
    this.night = night;
    const dusk = clamp(1 - Math.abs(sunH) * 3.4, 0, 1) * clamp(day + 0.3, 0, 1);

    (this.scene.background as THREE.Color).copy(NIGHT_SKY).lerp(DAY_SKY, day).lerp(DUSK_SKY, dusk * 0.55);
    this.fog.color.copy(NIGHT_FOG).lerp(DAY_FOG, day).lerp(DUSK_FOG, dusk * 0.6);
    this.fog.density = this.baseFogDensity * (1 + night * 0.3);

    this.hemi.intensity = 0.22 + day * 0.85;
    this.hemi.color.copy(HEMI_NIGHT).lerp(HEMI_DAY, day);

    if (sunH > 0) {
      TMP_DIR.set(Math.cos(ang) * 0.9, Math.max(sunH, 0.05), 0.35).normalize();
      this.sun.color.copy(SUN_SET).lerp(SUN_DAY, clamp(sunH * 1.8, 0, 1));
      this.sun.intensity = clamp(sunH * 2.4, 0, 1.65);
    } else {
      TMP_DIR.set(-Math.cos(ang) * 0.9, Math.max(-sunH, 0.05), -0.35).normalize();
      this.sun.color.copy(MOON_COLOR);
      this.sun.intensity = night * 0.35;
    }
    this.sun.position.copy(playerPos).addScaledVector(TMP_DIR, 160);
    this.sunTarget.position.copy(playerPos);
    this.sunTarget.updateMatrixWorld();

    (this.stars.material as THREE.PointsMaterial).opacity = night * 0.9;

    TMP_POS.set(Math.cos(ang) * 0.9, sunH, 0.35).normalize();
    this.sunSprite.position.copy(playerPos).addScaledVector(TMP_POS, 640);
    (this.sunSprite.material as THREE.SpriteMaterial).opacity = clamp(sunH * 4 + 0.25, 0, 1);
    TMP_POS.negate();
    this.moonSprite.position.copy(playerPos).addScaledVector(TMP_POS, 640);
    (this.moonSprite.material as THREE.SpriteMaterial).opacity = night;

    this.cityBuild.update(dt, night, this.elapsed);
  }

  applyQuality(q: QualityPreset): void {
    this.baseFogDensity = q.fogDensity;
    this.sun.castShadow = q.shadows;
    if (q.shadows) {
      this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  /** In-game clock as HH:MM (24h). */
  clockString(): string {
    const h = Math.floor(this.timeOfDay);
    const m = Math.floor((this.timeOfDay - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  dispose(): void {
    this.cityBuild.dispose();
    disposeObject(this.scene);
    this.scene.clear();
  }
}
