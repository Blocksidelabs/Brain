import * as THREE from 'three';

export type WeatherType = 'sunny' | 'cloudy' | 'overcast' | 'rain' | 'storm' | 'fog';

const RAIN_COUNT = 800;

export class WeatherManager {
  current: WeatherType = 'sunny';
  target: WeatherType = 'sunny';
  auto = true;
  private autoTimer = 45; // seconds per weather period
  /** 0..1 blend factor towards target */
  private transition = 1;
  wetness = 0;
  fogFactor = 0; // 0 = clear, 1 = thick fog

  private rainPoints: THREE.Points;
  private rainVelocities: Float32Array;
  private rainArea = 120; // size of the rain box around player
  private lightningTimer = 0;
  private flashIntensity = 0;

  // Lightning light source to be attached to scene
  lightningLight: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    // Rain Particle System
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(RAIN_COUNT * 3);
    this.rainVelocities = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.rainArea;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.rainArea;
      this.rainVelocities[i] = 45 + Math.random() * 15; // fall speed
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xaab7c4,
      size: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.rainPoints = new THREE.Points(geo, mat);
    this.rainPoints.frustumCulled = false;
    this.rainPoints.visible = false;
    scene.add(this.rainPoints);

    this.lightningLight = new THREE.PointLight(0x9db4ff, 0, 500, 2);
    scene.add(this.lightningLight);
  }

  setWeather(type: WeatherType): void {
    if (this.target === type) return;
    this.target = type;
    this.transition = 0;
  }

  update(dt: number, playerPos: THREE.Vector3, _nightFactor: number): void {
    // Automatic weather cycling
    if (this.auto) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        this.autoTimer = 45 + Math.random() * 45;
        const types: WeatherType[] = ['sunny', 'cloudy', 'overcast', 'rain', 'storm', 'fog'];
        const next = types[Math.floor(Math.random() * types.length)];
        this.setWeather(next);
      }
    }
    // Transition logic
    if (this.transition < 1) {
      this.transition = Math.min(1, this.transition + dt * 0.1); // ~10s transition
      // We only switch visual params once transition is done for simplicity 
      // or blend them if we had full param sets. For now, snap targets when transition finishes 
      // but lerp intensity values
    }
    if (this.transition >= 1 && this.current !== this.target) {
      this.current = this.target;
    }

    // Determine effective intensity of rain/fog based on current type
    let targetRain: number;
    let targetFog: number;
    let targetWet: number;

    switch (this.current) {
      case 'rain': targetRain = 0.6; targetFog = 0.2; targetWet = 1; break;
      case 'storm': targetRain = 1.0; targetFog = 0.4; targetWet = 1; break;
      case 'fog': targetRain = 0; targetFog = 1; targetWet = 0.2; break;
      case 'overcast': targetRain = 0; targetFog = 0.1; targetWet = 0; break;
      default: targetRain = 0; targetFog = 0; targetWet = 0;
    }

    // Smoothly approach targets
    this.wetness += (targetWet - this.wetness) * dt * 0.2;
    this.fogFactor += (targetFog - this.fogFactor) * dt * 0.5;

    // Rain Particles
    const mat = this.rainPoints.material as THREE.PointsMaterial;
    const targetOpacity = targetRain * 0.6;
    mat.opacity += (targetOpacity - mat.opacity) * dt * 2;
    this.rainPoints.visible = mat.opacity > 0.01;

    if (this.rainPoints.visible) {
      this.rainPoints.position.set(playerPos.x, playerPos.y, playerPos.z);
      const posAttr = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speedMult = 1 + targetRain * 0.5;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const y = arr[i * 3 + 1] - this.rainVelocities[i] * dt * speedMult;
        if (y < 0) {
          arr[i * 3] = (Math.random() - 0.5) * this.rainArea;
          arr[i * 3 + 1] = 40;
          arr[i * 3 + 2] = (Math.random() - 0.5) * this.rainArea;
        } else {
          arr[i * 3 + 1] = y;
          // Wind slant
          arr[i * 3] += dt * 2; 
        }
      }
      posAttr.needsUpdate = true;
    }

    // Lightning
    if (this.current === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 6 + Math.random() * 10;
        this.flashIntensity = 1.0;
        // Random position near player
        this.lightningLight.position.set(
          playerPos.x + (Math.random() - 0.5) * 200,
          50 + Math.random() * 50,
          playerPos.z + (Math.random() - 0.5) * 200
        );
        this.lightningLight.intensity = 0; // start dark, flash via update
      }
    }

    // Decay flash
    if (this.flashIntensity > 0) {
      this.flashIntensity -= dt * 4;
      this.lightningLight.intensity = Math.max(0, this.flashIntensity) * 5000;
    } else {
      this.lightningLight.intensity = 0;
    }
  }

  /** Modifies the standard fog color/density based on weather */
  applyToEnvironment(fog: THREE.FogExp2, hemiLight: THREE.HemisphereLight): void {
    // Overcast/Grey adjustment
    if (this.current === 'overcast' || this.current === 'rain' || this.current === 'storm') {
      const grey = new THREE.Color(0x707a86);
      fog.color.lerp(grey, 0.4);
      hemiLight.intensity *= 0.7; // Dim sun
    }
    
    // Add fog density
    const extra = this.fogFactor * 0.02; // Fog adds significant density
    if (this.current === 'rain' || this.current === 'storm') {
        fog.density += 0.004; // Rain haze
    }
    fog.density += extra;
  }
}
