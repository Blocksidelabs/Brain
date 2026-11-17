import * as THREE from 'three';
import { UniformsLib, UniformsUtils } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY } from '../../config/gameConfig';
import { mulberry32 } from '../../engine/mathUtils';
import type { CityData } from './CityGenerator';
import { GAS_LOT, PARK_LOT, PLAZA_LOT } from './CityGenerator';
import { roadCoord } from '../network/cityNetwork';
import { blockCenter, blockZone } from './zones';
import { getBuildingStyle, buildGasStationStyle } from './buildingKit';
import {
  makeBillboardTexture,
  makeFrondTexture,
  makeGlowTexture,
  makeSignTexture,
  SIGN_LABELS,
} from './textures';
import { buildGround } from './groundPlan';

export interface CityBuild {
  group: THREE.Group;
  update(dt: number, night: number, elapsed: number): void;
  setWetness(w: number): void;
  dispose(): void;
}

const FACE_DIR: Array<[number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const FACE_ROT = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];

interface FlickerEntry {
  mat: THREE.MeshBasicMaterial;
  phase: number;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    // geometries flagged `shared` live in the building-style cache and must
    // survive a session teardown
    if (mesh.geometry && !mesh.userData.shared) mesh.geometry.dispose();
    const mat = (mesh as Partial<THREE.Mesh>).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

export function buildCity(data: CityData): CityBuild {
  const group = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // ---------- ground + outskirt ----------
  const ground = buildGround();
  group.add(ground);
  const groundMat = ground.material as THREE.MeshStandardMaterial;
  const baseGroundColor = groundMat.color.clone();

  const outskirt = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 1 }),
  );
  outskirt.rotation.x = -Math.PI / 2;
  outskirt.position.y = -0.05;
  outskirt.receiveShadow = true;
  group.add(outskirt);

  // ---------- ocean ----------
  const oceanUniforms = UniformsUtils.merge([UniformsLib.fog, {}]) as Record<string, THREE.IUniform>;
  oceanUniforms.uTime = { value: 0 };
  oceanUniforms.uNight = { value: 0 };
  oceanUniforms.uDeep = { value: new THREE.Color('#061a30') };
  oceanUniforms.uShallow = { value: new THREE.Color('#0d3f63') };
  oceanUniforms.uNeon = { value: new THREE.Color('#7a2bd0') };
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float t = uTime;
        float w1 = sin(wp.x * 0.09 + t * 1.2);
        float w2 = sin(wp.z * 0.06 + t * 0.9 + wp.x * 0.03);
        wp.y += w1 * 0.16 + w2 * 0.12;
        float dwdx = 0.16 * 0.09 * cos(wp.x * 0.09 + t * 1.2)
          + 0.12 * 0.03 * cos(wp.z * 0.06 + t * 0.9 + wp.x * 0.03);
        float dwdz = 0.12 * 0.06 * cos(wp.z * 0.06 + t * 0.9 + wp.x * 0.03);
        vNormalW = normalize(vec3(-dwdx, 1.0, -dwdz));
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        vFogDepth = -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uNeon;
      uniform float uTime;
      uniform float uNight;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 N = normalize(vNormalW);
        float fres = pow(1.0 - max(dot(V, N), 0.0), 2.0);
        float sparkle = smoothstep(0.75, 1.0,
          sin(vWorld.x * 0.9 + uTime * 2.0) * sin(vWorld.z * 1.3 - uTime * 1.4));
        vec3 col = mix(uDeep, uShallow, clamp(fres * 0.85 + sparkle * 0.25, 0.0, 1.0));
        col += uNeon * fres * (0.25 + 0.35 * uNight);
        float shore = smoothstep(2.0, 0.2, vWorld.x - ${CITY.waterlineX.toFixed(1)});
        float foam = shore * (0.55 + 0.45 * sin(uTime * 1.6 + vWorld.z * 0.15));
        col = mix(col, vec3(0.92, 0.97, 1.0), foam * 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 900, 48, 32), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CITY.waterlineX + 700, -0.35, 0);
  group.add(ocean);

  // ---------- buildings (merged archetype geometry, vertex-coloured) ----------
  const structureMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.06 });
  const windowGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  for (const b of data.buildings) {
    const variant = Math.abs(Math.round((b.x * 7 + b.z * 11) | 0)) % 3;
    const style = getBuildingStyle(b, variant);
    const mesh = new THREE.Mesh(style.structure, structureMat);
    mesh.position.set(b.x, 0, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.shared = true;
    group.add(mesh);
    const glow = new THREE.Mesh(style.glow, windowGlowMat);
    glow.position.set(b.x, 0, b.z);
    glow.renderOrder = 1;
    glow.userData.shared = true;
    group.add(glow);
  }

  // gas stations (dedicated lot: shop + canopy + pumps)
  for (const gas of data.gasStations) {
    const style = buildGasStationStyle();
    const mesh = new THREE.Mesh(style.structure, structureMat);
    mesh.position.set(gas.x, 0, gas.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.shared = true;
    group.add(mesh);
    const glow = new THREE.Mesh(style.glow, windowGlowMat);
    glow.position.set(gas.x, 0, gas.z);
    glow.renderOrder = 1;
    glow.userData.shared = true;
    group.add(glow);
  }

  // ---------- rooftop props ----------
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0);

  if (data.roofProps.length > 0) {
    const propMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.9 });
    const propMesh = new THREE.InstancedMesh(unitBox, propMat, data.roofProps.length);
    const m = new THREE.Matrix4();
    data.roofProps.forEach((p, idx) => {
      m.makeScale(p.w, p.h, p.d);
      m.setPosition(p.x, p.y + p.h / 2, p.z);
      propMesh.setMatrixAt(idx, m);
    });
    propMesh.instanceMatrix.needsUpdate = true;
    propMesh.castShadow = true;
    group.add(propMesh);
  }

  // ---------- neon signs ----------
  const flickers: FlickerEntry[] = [];
  const FLICKER_INDICES = new Set([2, 5, 9]);
  const signPlane = new THREE.PlaneGeometry(1, 1);
  SIGN_LABELS.forEach((label, i) => {
    const withSign = data.buildings.filter((b) => b.sign && b.sign.tex === i);
    if (withSign.length === 0) return;
    const mat = new THREE.MeshBasicMaterial({
      map: keep(makeSignTexture(label)),
      transparent: true,
      color: new THREE.Color(1.6, 1.6, 1.6),
    });
    if (FLICKER_INDICES.has(i)) flickers.push({ mat, phase: i * 1.37 });
    const mesh = new THREE.InstancedMesh(signPlane, mat, withSign.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    withSign.forEach((b, idx) => {
      const sign = b.sign!;
      const [dx, dz] = FACE_DIR[sign.face];
      const half = sign.face % 2 === 0 ? b.d / 2 : b.w / 2;
      p.set(b.x + dx * (half + 0.15), sign.y, b.z + dz * (half + 0.15));
      e.set(0, FACE_ROT[sign.face], 0);
      q.setFromEuler(e);
      s.set(sign.w, sign.h, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(idx, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  });

  // ---------- landmark billboards ----------
  const billboardFx: FlickerEntry[] = [];
  const billboards: Array<{ x: number; z: number; rotY: number; h: number; w: number; hh: number; l1: string; l2: string | null; phase: number }> = [
    { x: 10, z: -76, rotY: -Math.PI / 2, h: 18, w: 16, hh: 8, l1: 'BLOCKSIDE', l2: 'THE CITY IS YOURS.', phase: 0 },
    { x: 338, z: -120, rotY: -Math.PI / 2, h: 12, w: 12, hh: 6, l1: 'SUNSET STRIP', l2: 'MILE 0', phase: 2.1 },
    { x: -160, z: 332, rotY: Math.PI, h: 14, w: 14, hh: 7, l1: 'BLOCKSIDE FM 88.3', l2: 'NEON NIGHTS · FRIDAY', phase: 4.2 },
    { x: -332, z: 80, rotY: Math.PI / 2, h: 12, w: 12, hh: 6, l1: 'PALM COURT MALL', l2: 'OPEN 24H', phase: 1.2 },
  ];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x181b22, roughness: 0.8, metalness: 0.3 });
  for (const bb of billboards) {
    const pole = new THREE.Mesh(unitBox, poleMat);
    pole.scale.set(1.1, bb.h, 1.1);
    pole.position.set(bb.x, 0, bb.z);
    pole.castShadow = true;
    group.add(pole);
    const mat = new THREE.MeshBasicMaterial({ map: keep(makeBillboardTexture(bb.l1, bb.l2)) });
    mat.color.setScalar(1.5);
    billboardFx.push({ mat, phase: bb.phase });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bb.w, bb.hh), mat);
    plane.position.set(bb.x, bb.h + bb.hh / 2 + 0.4, bb.z);
    plane.rotation.y = bb.rotY;
    group.add(plane);
  }

  // ---------- street lamps ----------
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x232830, roughness: 0.6, metalness: 0.4 });
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0x2a2620,
    emissive: 0xffd9a3,
    emissiveIntensity: 0.2,
    roughness: 0.5,
  });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 6, 6);
  poleGeo.translate(0, 3, 0);
  const armGeo = new THREE.BoxGeometry(1.1, 0.09, 0.09);
  armGeo.translate(0.55, 0, 0);
  const headGeo = new THREE.SphereGeometry(0.24, 8, 8);
  const lampPoles = new THREE.InstancedMesh(poleGeo, lampPoleMat, data.lamps.length);
  const lampArms = new THREE.InstancedMesh(armGeo, lampPoleMat, data.lamps.length);
  const lampHeads = new THREE.InstancedMesh(headGeo, lampHeadMat, data.lamps.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    data.lamps.forEach((l, idx) => {
      e.set(0, l.rotY, 0);
      q.setFromEuler(e);
      p.set(l.x, 0, l.z);
      m.compose(p, q, one);
      lampPoles.setMatrixAt(idx, m);
      p.set(l.x, 5.85, l.z);
      m.compose(p, q, one);
      lampArms.setMatrixAt(idx, m);
      p.set(l.x + Math.cos(l.rotY) * 1.1, 5.8, l.z - Math.sin(l.rotY) * 1.1);
      m.compose(p, q, one);
      lampHeads.setMatrixAt(idx, m);
    });
    lampPoles.instanceMatrix.needsUpdate = true;
    lampArms.instanceMatrix.needsUpdate = true;
    lampHeads.instanceMatrix.needsUpdate = true;
    lampPoles.castShadow = true;
    group.add(lampPoles, lampArms, lampHeads);
  }

  // ---------- lamp light pools (asphalt glow at night) ----------
  const poolMat = new THREE.MeshBasicMaterial({
    map: keep(makeGlowTexture('rgba(255,214,150,0.85)')),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, data.lamps.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(7, 1, 7);
    const p = new THREE.Vector3();
    data.lamps.forEach((l, idx) => {
      p.set(l.x + Math.cos(l.rotY) * 1.1, 0.04, l.z - Math.sin(l.rotY) * 1.1);
      m.compose(p, q, s);
      pools.setMatrixAt(idx, m);
    });
    pools.instanceMatrix.needsUpdate = true;
    pools.renderOrder = 2;
    group.add(pools);
  }

  // ---------- traffic lights (visual; logic arrives with traffic in Phase 4) ----------
  {
    const tlCount = data.trafficLights.length;
    if (tlCount > 0) {
      const tlPoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.8, 6);
      tlPoleGeo.translate(0, 1.9, 0);
      const tlHeadGeo = new THREE.BoxGeometry(0.36, 1.05, 0.28);
      tlHeadGeo.translate(0, 3.35, 0.16);
      const tlPoles = new THREE.InstancedMesh(tlPoleGeo, lampPoleMat, tlCount);
      const tlHeads = new THREE.InstancedMesh(tlHeadGeo, lampPoleMat, tlCount);
      const dotGeo = new THREE.SphereGeometry(0.09, 8, 8);
      const dotDefs: Array<{ y: number; color: string }> = [
        { y: 3.62, color: '#ff4d4d' },
        { y: 3.35, color: '#ffcf4d' },
        { y: 3.08, color: '#4dff88' },
      ];
      const dotMeshes = dotDefs.map((d) => {
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.color).multiplyScalar(2) });
        const g = dotGeo.clone();
        g.translate(0, d.y, 0.33);
        return new THREE.InstancedMesh(g, mat, tlCount);
      });
      const m = new THREE.Matrix4();
      data.trafficLights.forEach((t, idx) => {
        m.makeTranslation(t.x, 0, t.z);
        tlPoles.setMatrixAt(idx, m);
        tlHeads.setMatrixAt(idx, m);
        dotMeshes.forEach((dm) => dm.setMatrixAt(idx, m));
      });
      tlPoles.instanceMatrix.needsUpdate = true;
      tlHeads.instanceMatrix.needsUpdate = true;
      dotMeshes.forEach((dm) => {
        dm.instanceMatrix.needsUpdate = true;
      });
      tlPoles.castShadow = true;
      group.add(tlPoles, tlHeads, ...dotMeshes);
    }
  }

  // ---------- palms ----------
  {
    const frondTex = keep(makeFrondTexture());
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1 });
    const frondMat = new THREE.MeshStandardMaterial({
      map: frondTex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.17, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const n = data.palms.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    const frondBase = new THREE.PlaneGeometry(0.85, 3.1, 1, 6);
    frondBase.rotateX(-Math.PI / 2);
    {
      const pos = frondBase.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const t = (1.55 - z) / 3.1; // 0 at base, 1 at tip
        pos.setX(i, pos.getX(i) * (1 - t * 0.78));
        pos.setY(i, pos.getY(i) - t * t * 1.25);
      }
      frondBase.translate(0, 0, -1.55);
      frondBase.computeVertexNormals();
    }
    const FRONDS_PER_PALM = 8;
    const fronds = new THREE.InstancedMesh(frondBase, frondMat, n * FRONDS_PER_PALM);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const axis = new THREE.Vector3();
    data.palms.forEach((pal, idx) => {
      axis.set(Math.cos(pal.rot), 0, Math.sin(pal.rot));
      q.setFromAxisAngle(axis, pal.tilt);
      p.set(pal.x, 0, pal.z);
      s.set(1, pal.h, 1);
      m.compose(p, q, s);
      trunks.setMatrixAt(idx, m);
      // tilted trunk-top position (Rodrigues rotation of +Y by tilt around axis)
      const st = Math.sin(pal.tilt);
      const ct = Math.cos(pal.tilt);
      p.set(pal.x - axis.z * st * pal.h, ct * pal.h, pal.z + axis.x * st * pal.h);
      const fs = Math.min(1.4, Math.max(0.7, pal.h / 6));
      s.set(fs, fs, fs);
      for (let i = 0; i < FRONDS_PER_PALM; i++) {
        const jitter = ((idx * 137 + i * 31) % 100) / 100;
        e.set(-0.22 - jitter * 0.35, pal.rot + (i * Math.PI * 2) / FRONDS_PER_PALM + jitter * 0.6, 0, 'YXZ');
        q.setFromEuler(e);
        m.compose(p, q, s);
        fronds.setMatrixAt(idx * FRONDS_PER_PALM + i, m);
      }
    });
    trunks.instanceMatrix.needsUpdate = true;
    fronds.instanceMatrix.needsUpdate = true;
    trunks.castShadow = true;
    group.add(trunks, fronds);
  }

  // ---------- street furniture (instanced props) ----------
  {
    const propRng = mulberry32(2024);
    const mergedGeo = (parts: Array<[number, number, number, number, number, number]>): THREE.BufferGeometry => {
      const list = parts.map(([w, h, d, x, y, z]) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        return g;
      });
      const merged = mergeGeometries(list, false)!;
      list.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      return merged;
    };
    const instanced = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      spots: Array<{ x: number; z: number; ry?: number }>,
      shadow = true,
    ): void => {
      if (spots.length === 0) return;
      const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const p = new THREE.Vector3();
      const one = new THREE.Vector3(1, 1, 1);
      spots.forEach((spot, i) => {
        e.set(0, spot.ry ?? 0, 0);
        q.setFromEuler(e);
        p.set(spot.x, 0, spot.z);
        m.compose(p, q, one);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    const benchGeo = mergedGeo([
      [1.6, 0.08, 0.45, 0, 0.45, 0],
      [0.08, 0.45, 0.4, -0.7, 0.22, 0],
      [0.08, 0.45, 0.4, 0.7, 0.22, 0],
    ]);
    const binGeo = mergedGeo([
      [0.5, 0.8, 0.5, 0, 0.4, 0],
      [0.56, 0.06, 0.56, 0, 0.84, 0],
    ]);
    const hydrantGeo = mergedGeo([
      [0.22, 0.55, 0.22, 0, 0.28, 0],
      [0.32, 0.1, 0.32, 0, 0.6, 0],
    ]);
    const busStopGeo = mergedGeo([
      [2.6, 0.08, 1.4, 0, 2.5, 0],
      [2.6, 2.2, 0.1, 0, 1.1, 0.65],
      [0.1, 2.5, 1.4, -1.3, 1.25, 0],
      [0.1, 2.5, 1.4, 1.3, 1.25, 0],
      [1.7, 0.08, 0.4, 0, 0.55, -0.3],
    ]);
    const umbrellaGeo = (() => {
      const canopy = new THREE.CylinderGeometry(0.06, 1.05, 0.5, 8);
      canopy.translate(0, 1.95, 0);
      const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.1, 6);
      pole.translate(0, 1.05, 0);
      const merged = mergeGeometries([canopy, pole], false)!;
      canopy.dispose();
      pole.dispose();
      merged.computeBoundingSphere();
      return merged;
    })();
    const towelGeo = new THREE.BoxGeometry(0.8, 0.04, 1.6);
    const hedgeGeo = new THREE.BoxGeometry(2.6, 0.75, 0.7);
    const planterGeo = mergedGeo([
      [1.2, 0.55, 1.2, 0, 0.28, 0],
      [1.0, 0.3, 1.0, 0, 0.62, 0],
    ]);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5c40, roughness: 0.9 });
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.8, metalness: 0.3 });
    const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.5, metalness: 0.4 });
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2e6b45, roughness: 1 });
    const planterMat = new THREE.MeshStandardMaterial({ color: 0x8d8779, roughness: 0.95 });
    const towelMat = new THREE.MeshStandardMaterial({ color: 0xff5c8a, roughness: 1 });
    const umbrellaMats = [0xff2d95, 0x2ec4b6].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }),
    );

    const benches: Array<{ x: number; z: number }> = [];
    const planters: Array<{ x: number; z: number }> = [];
    const bins: Array<{ x: number; z: number }> = [];
    const hydrants: Array<{ x: number; z: number }> = [];
    const hedges: Array<{ x: number; z: number }> = [];
    for (let bz = 0; bz < CITY.grid; bz++) {
      for (let bx = 0; bx < CITY.grid; bx++) {
        const cx = blockCenter(bx);
        const cz = blockCenter(bz);
        const special =
          (bx === PLAZA_LOT.bx && bz === PLAZA_LOT.bz) ||
          (bx === PARK_LOT.bx && bz === PARK_LOT.bz) ||
          (bx === GAS_LOT.bx && bz === GAS_LOT.bz);
        const zone = blockZone(bx, bz);
        if (special || zone === 'industrial') continue;
        if (zone === 'downtown' || zone === 'nightlife') {
          benches.push({ x: cx - 12, z: cz + 30.5 }, { x: cx + 12, z: cz + 30.5 });
          planters.push({ x: cx - 20, z: cz + 30.5 }, { x: cx + 20, z: cz - 30.5 });
        }
        bins.push({ x: cx + 30.5, z: cz + 26 });
        if (propRng() < 0.4) hydrants.push({ x: cx - 30.5, z: cz + 22 });
        if (zone === 'residential') {
          hedges.push({ x: cx - 10, z: cz - 29.5 }, { x: cx + 10, z: cz - 29.5 });
        }
      }
    }
    instanced(benchGeo, woodMat, benches);
    instanced(planterGeo, planterMat, planters);
    instanced(binGeo, binMat, bins);
    instanced(hydrantGeo, hydrantMat, hydrants);
    instanced(hedgeGeo, hedgeMat, hedges);

    const busStops: Array<{ x: number; z: number; ry: number }> = [];
    for (const [kx, kz] of [
      [4, 4],
      [2, 6],
      [7, 3],
      [1, 1],
      [5, 5],
      [6, 2],
    ] as const) {
      busStops.push({ x: roadCoord(kx) + 16, z: roadCoord(kz) + 16, ry: Math.PI / 4 });
    }
    instanced(busStopGeo, steelMat, busStops);

    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6);
    poleGeo.translate(0, 1.2, 0);
    const plateGeo = new THREE.BoxGeometry(0.6, 0.6, 0.05);
    plateGeo.translate(0, 2.2, 0);
    const signSpots: Array<{ x: number; z: number; ry: number }> = [];
    for (let i = 0; i < 12; i++) {
      const along = -300 + (i / 12) * 600;
      if (i % 2 === 0) {
        signSpots.push({ x: roadCoord(i % 9) + 10.5, z: along, ry: 0 });
      } else {
        signSpots.push({ x: along, z: roadCoord(i % 9) - 10.5, ry: Math.PI / 2 });
      }
    }
    instanced(poleGeo, steelMat, signSpots);
    instanced(plateGeo, new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.5 }), signSpots, false);

    const umbA: Array<{ x: number; z: number }> = [];
    const umbB: Array<{ x: number; z: number }> = [];
    const towels: Array<{ x: number; z: number; ry: number }> = [];
    for (let i = 0; i < 26; i++) {
      const x = 336 + propRng() * 14;
      const z = -280 + propRng() * 560;
      (i % 2 ? umbB : umbA).push({ x, z });
      if (i % 3 === 0) {
        towels.push({ x: x - 2 - propRng() * 2, z: z + propRng() * 6 - 3, ry: propRng() * Math.PI });
      }
    }
    instanced(umbrellaGeo, umbrellaMats[0], umbA, false);
    instanced(umbrellaGeo, umbrellaMats[1], umbB, false);
    instanced(towelGeo, towelMat, towels, false);

    const towerGeo = mergedGeo([
      [0.15, 2.6, 0.15, -0.8, 1.3, -0.8],
      [0.15, 2.6, 0.15, 0.8, 1.3, -0.8],
      [0.15, 2.6, 0.15, -0.8, 1.3, 0.8],
      [0.15, 2.6, 0.15, 0.8, 1.3, 0.8],
      [2.1, 1.5, 2.1, 0, 3.35, 0],
      [2.7, 0.14, 2.7, 0, 4.25, 0],
      [1.9, 0.08, 0.9, 0, 2.75, 1.2],
    ]);
    const towerMesh = new THREE.Mesh(towerGeo, new THREE.MeshStandardMaterial({ color: 0xd96a4a, roughness: 0.85 }));
    towerMesh.position.set(348, 0, 100);
    towerMesh.castShadow = true;
    group.add(towerMesh);
  }

  // ---------- frame update / teardown ----------
  const update = (_dt: number, night: number, elapsed: number): void => {
    oceanUniforms.uTime.value = elapsed;
    oceanUniforms.uNight.value = night;
    windowGlowMat.color.setScalar(0.06 + night * 1.9);
    lampHeadMat.emissiveIntensity = 0.15 + night * 2.4;
    poolMat.opacity = night * 0.85;
    for (const f of flickers) {
      const wave = Math.sin(elapsed * 13.7 + f.phase) + Math.sin(elapsed * 7.3 + f.phase * 2.1);
      f.mat.color.setScalar(wave > 1.15 ? 0.35 : 1.6);
    }
    for (const b of billboardFx) {
      b.mat.color.setScalar(1.5 + Math.sin(elapsed * 1.8 + b.phase) * 0.25);
    }
  };

  const dispose = (): void => {
    disposeObject(group);
    textures.forEach((t) => t.dispose());
    textures.length = 0;
  };

  const setWetness = (w: number): void => {
    // Wet roads: darker, less rough (reflective), slightly metallic
    groundMat.roughness = 0.94 - w * 0.65;
    groundMat.metalness = w * 0.35;
    groundMat.color.copy(baseGroundColor).lerp(new THREE.Color(0x05070c), w * 0.45);
  };

  return { group, update, setWetness, dispose };
}
