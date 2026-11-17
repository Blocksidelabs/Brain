import * as THREE from 'three';
import { VEHICLE_SPECS, type VehicleKind, type VehicleSpec } from './vehicleTypes';
import { makeSignTexture } from '../city/textures';

export interface VehicleModel {
  root: THREE.Group;
  /** wheel pivot nodes, order FL FR RL RR (steer yaw applied here) */
  wheels: THREE.Object3D[];
  /** spin children inside each wheel pivot (rolling rotation.x) */
  spins: THREE.Object3D[];
  steeringWheel: THREE.Object3D | null;
}

interface Template {
  model: VehicleModel;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  bodyMaterial: THREE.MeshStandardMaterial;
}

const templates = new Map<VehicleKind, Template>();
const WHEEL_NAMES = ['wheel-fl', 'wheel-fr', 'wheel-rl', 'wheel-rr'];

/** Every light material in the game, driven by the day/night cycle. */
const lightMats: THREE.MeshBasicMaterial[] = [];

export function setVehicleNight(night: number): void {
  for (const m of lightMats) {
    const kind = m.userData.kind as string;
    if (kind === 'head') {
      m.color.setRGB(1.1 + 1.9 * night, 1.1 + 1.9 * night, 1.0 + 1.7 * night);
    } else if (kind === 'tail') {
      m.color.setRGB(0.7 + 2.3 * night, 0.1 + 0.15 * night, 0.14 + 0.2 * night);
    } else {
      m.opacity = night * 0.3; // headlight ground beam
    }
  }
}

function lightMat(kind: 'head' | 'tail', color: THREE.Color): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color });
  m.userData.kind = kind;
  lightMats.push(m);
  return m;
}

interface Kit {
  spec: VehicleSpec;
  geos: THREE.BufferGeometry[];
  extra: THREE.Material[];
  mats: {
    body: THREE.MeshStandardMaterial;
    glass: THREE.MeshStandardMaterial;
    dark: THREE.MeshStandardMaterial;
    tire: THREE.MeshStandardMaterial;
    rim: THREE.MeshStandardMaterial;
    rimDark: THREE.MeshStandardMaterial;
    head: THREE.MeshBasicMaterial;
    tail: THREE.MeshBasicMaterial;
    glow: THREE.MeshBasicMaterial;
  };
}

function makeKit(spec: VehicleSpec): Kit {
  const body = new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0.6, roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8fc7e8,
    metalness: 0.1,
    roughness: 0.12,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return {
    spec,
    geos: [],
    extra: [],
    mats: {
      body,
      glass,
      dark: new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.8, metalness: 0.2 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.95 }),
      rim: new THREE.MeshStandardMaterial({ color: 0xb9c2d0, metalness: 0.85, roughness: 0.3 }),
      rimDark: new THREE.MeshStandardMaterial({ color: 0x2a2d35, metalness: 0.6, roughness: 0.4 }),
      head: lightMat('head', new THREE.Color(1.2, 1.2, 1.1)),
      tail: lightMat('tail', new THREE.Color(0.7, 0.1, 0.14)),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.accentColor).multiplyScalar(2) }),
    },
  };
}

function box(
  kit: Kit,
  parent: THREE.Object3D,
  m: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  kit.geos.push(geo);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildWheel(kit: Kit, radius: number): { pivot: THREE.Object3D; spin: THREE.Object3D } {
  const pivot = new THREE.Object3D();
  const spin = new THREE.Object3D();
  spin.name = 'spin';
  const tireGeo = new THREE.CylinderGeometry(radius, radius, kit.spec.wheelWidth, 14);
  tireGeo.rotateZ(Math.PI / 2);
  kit.geos.push(tireGeo);
  const tire = new THREE.Mesh(tireGeo, kit.mats.tire);
  tire.castShadow = true;
  spin.add(tire);
  const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, kit.spec.wheelWidth + 0.02, 10);
  rimGeo.rotateZ(Math.PI / 2);
  kit.geos.push(rimGeo);
  spin.add(new THREE.Mesh(rimGeo, kit.mats.rim));
  const spokeGeo = new THREE.BoxGeometry(kit.spec.wheelWidth + 0.04, radius * 1.02, 0.05);
  kit.geos.push(spokeGeo);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeo, kit.mats.rimDark);
    spoke.rotation.x = (i / 5) * Math.PI;
    spin.add(spoke);
  }
  pivot.add(spin);
  return { pivot, spin };
}

function addInterior(kit: Kit, root: THREE.Object3D, cabinY: number): void {
  const eye = kit.spec.eye;
  box(kit, root, kit.mats.dark, 1.34, 0.16, 0.42, 0, cabinY + 0.02, eye.z - 0.6); // dashboard
  box(kit, root, kit.mats.glow, 1.3, 0.03, 0.06, 0, cabinY + 0.06, eye.z - 0.78); // dash light strip
  box(kit, root, kit.mats.dark, 0.46, 0.14, 0.5, eye.x, cabinY - 0.28, eye.z + 0.28); // seat cushion
  box(kit, root, kit.mats.dark, 0.44, 0.52, 0.14, eye.x, cabinY + 0.02, eye.z + 0.56); // seat back
  const mount = new THREE.Group();
  mount.position.set(eye.x, eye.y - 0.16, eye.z - 0.52);
  mount.rotation.x = -1.05;
  const wheelNode = new THREE.Group();
  wheelNode.name = 'steering-wheel';
  const rimGeo = new THREE.TorusGeometry(0.17, 0.026, 8, 20);
  kit.geos.push(rimGeo);
  wheelNode.add(new THREE.Mesh(rimGeo, kit.mats.rimDark));
  const spokeGeo = new THREE.BoxGeometry(0.03, 0.3, 0.02);
  kit.geos.push(spokeGeo);
  for (const a of [0, 2.09, 4.19]) {
    const spoke = new THREE.Mesh(spokeGeo, kit.mats.rimDark);
    spoke.rotation.z = a;
    wheelNode.add(spoke);
  }
  mount.add(wheelNode);
  root.add(mount);
}

/** Adds visual fenders over the wheels to ground the vehicle visually. */
function addWheelArches(kit: Kit, root: THREE.Group): void {
  const s = kit.spec;
  if (s.kind === 'moto') return;
  // Wheels hang below the chassis origin. Arch should sit at wheel center height.
  const yArch = 0.04 - s.suspension.rest;
  const archMat = kit.mats.body;
  const positions = [
    [s.trackX, -s.wheelBaseZ],
    [s.trackX, s.wheelBaseZ],
    [-s.trackX, -s.wheelBaseZ],
    [-s.trackX, s.wheelBaseZ],
  ];
  for (const [x, z] of positions) {
    box(kit, root, archMat, 0.3, 0.14, 0.9, x, yArch, z);
  }
}

function buildCoupe(kit: Kit): VehicleModel {
  const g = new THREE.Group();
  box(kit, g, kit.mats.body, 1.8, 0.5, 4.2, 0, 0.42, 0); // main body
  box(kit, g, kit.mats.body, 1.72, 0.26, 1.1, 0, 0.3, -1.7, 0.05); // nose wedge
  box(kit, g, kit.mats.glass, 1.56, 0.42, 2.0, 0, 0.86, 0.24); // greenhouse
  box(kit, g, kit.mats.body, 1.5, 0.09, 1.92, 0, 1.1, 0.24); // roof
  box(kit, g, kit.mats.dark, 1.84, 0.16, 0.34, 0, 0.26, -2.16); // front bumper
  box(kit, g, kit.mats.dark, 1.84, 0.16, 0.3, 0, 0.26, 2.14); // rear bumper
  box(kit, g, kit.mats.dark, 0.07, 0.14, 3.1, 0.92, 0.3, 0); // side skirt
  box(kit, g, kit.mats.dark, 0.07, 0.14, 3.1, -0.92, 0.3, 0);
  
  box(kit, g, kit.mats.glow, 0.08, 0.02, 3.9, 0, 0.685, 0); // neon racing stripe
  box(kit, g, kit.mats.head, 0.36, 0.09, 0.06, 0.56, 0.5, -2.14);
  box(kit, g, kit.mats.head, 0.36, 0.09, 0.06, -0.56, 0.5, -2.14);
  box(kit, g, kit.mats.tail, 1.62, 0.08, 0.05, 0, 0.56, 2.16);
  box(kit, g, kit.mats.body, 1.66, 0.05, 0.4, 0, 1.0, 1.9); // spoiler wing
  box(kit, g, kit.mats.dark, 0.08, 0.18, 0.2, 0.6, 0.9, 1.95);
  box(kit, g, kit.mats.dark, 0.08, 0.18, 0.2, -0.6, 0.9, 1.95);
  if (kit.spec.neonUnderglow) {
    const ugGeo = new THREE.PlaneGeometry(2.3, 4.7);
    ugGeo.rotateX(-Math.PI / 2);
    kit.geos.push(ugGeo);
    const ugMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(kit.spec.accentColor).multiplyScalar(1.6),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    kit.extra.push(ugMat);
    const glowPlane = new THREE.Mesh(ugGeo, ugMat);
    glowPlane.position.y = 0.045;
    glowPlane.renderOrder = 2;
    g.add(glowPlane);
  }
  return finish(kit, g, 0.6);
}

function buildSupercar(kit: Kit): VehicleModel {
  const g = new THREE.Group();
  box(kit, g, kit.mats.body, 1.92, 0.4, 4.4, 0, 0.34, 0);
  box(kit, g, kit.mats.body, 1.86, 0.2, 1.0, 0, 0.26, -1.85, 0.08); // nose
  box(kit, g, kit.mats.glass, 1.32, 0.34, 1.7, 0, 0.68, 0.05); // canopy
  box(kit, g, kit.mats.body, 1.26, 0.06, 1.5, 0, 0.87, 0.05);
  box(kit, g, kit.mats.dark, 1.96, 0.06, 0.5, 0, 0.14, -2.2); // splitter
  box(kit, g, kit.mats.body, 1.94, 0.05, 0.48, 0, 0.98, 2.0); // wing
  box(kit, g, kit.mats.dark, 0.05, 0.16, 0.5, 0.95, 0.94, 2.0);
  box(kit, g, kit.mats.dark, 0.05, 0.16, 0.5, -0.95, 0.94, 2.0);
  box(kit, g, kit.mats.dark, 0.08, 0.18, 0.2, 0.55, 0.88, 2.02);
  box(kit, g, kit.mats.dark, 0.08, 0.18, 0.2, -0.55, 0.88, 2.02);
  box(kit, g, kit.mats.dark, 0.72, 0.2, 0.6, 0, 0.6, 1.15); // engine intake
  box(kit, g, kit.mats.dark, 0.08, 0.24, 0.7, 0.97, 0.4, 0.8);
  box(kit, g, kit.mats.dark, 0.08, 0.24, 0.7, -0.97, 0.4, 0.8);
  box(kit, g, kit.mats.glow, 0.05, 0.02, 4.3, 0.18, 0.545, 0); // accent stripes
  box(kit, g, kit.mats.glow, 0.05, 0.02, 4.3, -0.18, 0.545, 0);
  box(kit, g, kit.mats.head, 0.4, 0.07, 0.05, 0.62, 0.42, -2.2);
  box(kit, g, kit.mats.head, 0.4, 0.07, 0.05, -0.62, 0.42, -2.2);
  box(kit, g, kit.mats.tail, 1.7, 0.07, 0.05, 0, 0.5, 2.2);
  return finish(kit, g, 0.5);
}

function buildSuv(kit: Kit): VehicleModel {
  const g = new THREE.Group();
  box(kit, g, kit.mats.body, 2.0, 0.74, 4.5, 0, 0.74, 0);
  box(kit, g, kit.mats.body, 1.94, 0.1, 1.2, 0, 1.06, -1.5); // hood
  box(kit, g, kit.mats.glass, 1.86, 0.5, 2.6, 0, 1.36, 0.3); // greenhouse
  box(kit, g, kit.mats.body, 1.8, 0.09, 2.5, 0, 1.66, 0.3); // roof
  box(kit, g, kit.mats.dark, 0.06, 0.08, 2.3, 0.7, 1.75, 0.3); // roof rails
  box(kit, g, kit.mats.dark, 0.06, 0.08, 2.3, -0.7, 1.75, 0.3);
  box(kit, g, kit.mats.dark, 1.3, 0.32, 0.16, 0, 0.55, -2.32); // bull bar
  box(kit, g, kit.mats.dark, 2.04, 0.22, 0.32, 0, 0.36, -2.28);
  box(kit, g, kit.mats.dark, 2.04, 0.22, 0.32, 0, 0.36, 2.28);
  box(kit, g, kit.mats.head, 0.4, 0.12, 0.06, 0.66, 0.86, -2.26);
  box(kit, g, kit.mats.head, 0.4, 0.12, 0.06, -0.66, 0.86, -2.26);
  box(kit, g, kit.mats.tail, 0.3, 0.2, 0.05, 0.7, 0.9, 2.26);
  box(kit, g, kit.mats.tail, 0.3, 0.2, 0.05, -0.7, 0.9, 2.26);
  box(kit, g, kit.mats.glow, 0.1, 0.04, 0.1, 0, 0.32, -2.4); // tow hooks
  return finish(kit, g, 1.0);
}

/** Attach wheels + interior + lights and collect the named animation nodes. */
function finish(kit: Kit, g: THREE.Group, cabinY: number): VehicleModel {
  const s = kit.spec;
  const wheels: THREE.Object3D[] = [];
  const spins: THREE.Object3D[] = [];
  const offsets: Array<[number, number]> = [
    [-s.trackX, -s.wheelBaseZ],
    [s.trackX, -s.wheelBaseZ],
    [-s.trackX, s.wheelBaseZ],
    [s.trackX, s.wheelBaseZ],
  ];
  offsets.forEach(([x, z], i) => {
    const { pivot, spin } = buildWheel(kit, s.wheelRadius);
    pivot.name = WHEEL_NAMES[i];
    pivot.position.set(x, 0, z);
    g.add(pivot);
    wheels.push(pivot);
    spins.push(spin);
  });
  addInterior(kit, g, cabinY);

  // headlight ground glow (night only — driven by setVehicleNight)
  const beamGeo = new THREE.PlaneGeometry(2.2, 3.6);
  beamGeo.rotateX(-Math.PI / 2);
  kit.geos.push(beamGeo);
  const beamMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.3, 1.2, 0.95),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  beamMat.userData.kind = 'beam';
  lightMats.push(beamMat);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, 0.06, -(s.bodyHalf.z + 1.8));
  beam.renderOrder = 3;
  g.add(beam);

  // door mirrors (everything except bikes)
  if (s.kind !== 'moto') {
    const my = s.eye.y - 0.12;
    const mx = s.bodyHalf.x + 0.08;
    box(kit, g, kit.mats.dark, 0.05, 0.09, 0.16, mx, my, s.eye.z - 0.78);
    box(kit, g, kit.mats.dark, 0.05, 0.09, 0.16, -mx, my, s.eye.z - 0.78);
  }

  // Visual grounding: add fenders over the wheels
  addWheelArches(kit, g);

  return { root: g, wheels, spins, steeringWheel: g.getObjectByName('steering-wheel') ?? null };
}

function buildSedan(kit: Kit): VehicleModel {
  const g = new THREE.Group();
  box(kit, g, kit.mats.body, 1.84, 0.5, 4.5, 0, 0.44, 0); // lower body
  box(kit, g, kit.mats.body, 1.72, 0.14, 2.4, 0, 0.74, 0.15); // shoulder line
  box(kit, g, kit.mats.glass, 1.7, 0.34, 2.3, 0, 0.9, 0.15); // glasshouse
  box(kit, g, kit.mats.body, 1.64, 0.07, 2.2, 0, 1.1, 0.15); // roof
  box(kit, g, kit.mats.dark, 1.88, 0.14, 0.3, 0, 0.28, -2.28);
  box(kit, g, kit.mats.dark, 1.88, 0.14, 0.3, 0, 0.28, 2.28);
  box(kit, g, kit.mats.dark, 1.2, 0.12, 0.05, 0, 0.45, -2.27); // grille
  box(kit, g, kit.mats.head, 0.34, 0.1, 0.06, 0.6, 0.5, -2.26);
  box(kit, g, kit.mats.head, 0.34, 0.1, 0.06, -0.6, 0.5, -2.26);
  box(kit, g, kit.mats.tail, 1.6, 0.09, 0.05, 0, 0.52, 2.27);
  box(kit, g, kit.mats.dark, 0.04, 0.05, 3.6, 0.94, 0.42, 0); // belt trim
  box(kit, g, kit.mats.dark, 0.04, 0.05, 3.6, -0.94, 0.42, 0);
  if (kit.spec.kind === 'taxi') {
    // roof sign with proper TAXI lettering
    const tex = makeSignTexture({ text: 'TAXI', color: '#ffd23c' });
    const plane = new THREE.PlaneGeometry(0.62, 0.2);
    kit.geos.push(plane);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    kit.extra.push(mat);
    box(kit, g, kit.mats.dark, 0.54, 0.14, 0.24, 0, 1.2, 0.15);
    for (const face of [1, -1]) {
      const sign = new THREE.Mesh(plane, mat);
      sign.position.set(0, 1.28, 0.15 + face * 0.121);
      if (face === 1) sign.rotation.y = Math.PI;
      g.add(sign);
    }
  }
  return finish(kit, g, 0.6);
}

function buildVan(kit: Kit): VehicleModel {
  const g = new THREE.Group();
  box(kit, g, kit.mats.body, 2.04, 1.06, 4.9, 0, 0.84, 0.2); // cargo box
  box(kit, g, kit.mats.body, 2.0, 0.8, 1.4, 0, 0.86, -1.8); // cab
  const windshield = new THREE.Mesh(
    (() => {
      const geo = new THREE.PlaneGeometry(1.84, 0.62);
      kit.geos.push(geo);
      return geo;
    })(),
    kit.mats.glass,
  );
  windshield.position.set(0, 1.06, -2.44);
  windshield.rotation.x = -0.12;
  g.add(windshield);
  box(kit, g, kit.mats.dark, 2.06, 0.2, 0.34, 0, 0.34, -2.5); // front bumper
  box(kit, g, kit.mats.dark, 2.06, 0.2, 0.34, 0, 0.34, 2.62);
  box(kit, g, kit.mats.dark, 0.03, 0.62, 0.95, 1.05, 0.95, 0.3); // slider door line
  box(kit, g, kit.mats.dark, 0.03, 0.62, 0.95, -1.05, 0.95, 0.3);
  const stripeMat = new THREE.MeshStandardMaterial({ color: kit.spec.accentColor, metalness: 0.5, roughness: 0.4 });
  kit.extra.push(stripeMat);
  box(kit, g, stripeMat, 2.06, 0.14, 4.6, 0, 0.52, 0.2); // company stripe
  box(kit, g, kit.mats.head, 0.36, 0.14, 0.06, 0.66, 0.62, -2.52);
  box(kit, g, kit.mats.head, 0.36, 0.14, 0.06, -0.66, 0.62, -2.52);
  box(kit, g, kit.mats.tail, 0.3, 0.4, 0.05, 0.7, 0.8, 2.66);
  box(kit, g, kit.mats.tail, 0.3, 0.4, 0.05, -0.7, 0.8, 2.66);
  return finish(kit, g, 1.0);
}

function buildMoto(kit: Kit): VehicleModel {
  const g = new THREE.Group();
  box(kit, g, kit.mats.body, 0.16, 0.22, 1.5, 0, 0.56, 0); // spine
  box(kit, g, kit.mats.body, 0.26, 0.16, 0.44, 0, 0.7, -0.25); // tank
  box(kit, g, kit.mats.dark, 0.26, 0.12, 0.6, 0, 0.66, 0.35); // seat
  box(kit, g, kit.mats.body, 0.14, 0.4, 0.34, 0, 0.72, -0.78, -0.35); // front cowl
  box(kit, g, kit.mats.dark, 0.52, 0.05, 0.05, 0, 0.92, -0.62); // handlebar
  const forkGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
  forkGeo.rotateX(0.28);
  kit.geos.push(forkGeo);
  const fork = new THREE.Mesh(forkGeo, kit.mats.rimDark);
  fork.position.set(0, 0.55, -0.75);
  g.add(fork);
  const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8);
  exhaustGeo.rotateX(Math.PI / 2);
  kit.geos.push(exhaustGeo);
  const exhaust = new THREE.Mesh(exhaustGeo, kit.mats.rim);
  exhaust.position.set(0.14, 0.36, 0.6);
  g.add(exhaust);
  box(kit, g, kit.mats.tail, 0.16, 0.06, 0.04, 0, 0.66, 0.88); // tail light
  box(kit, g, kit.mats.head, 0.14, 0.1, 0.05, 0, 0.78, -0.94); // head light
  // seated rider (tinted per traffic variety)
  const rider = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a37a, roughness: 0.7 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.8 });
  const riderGeo1 = new THREE.CapsuleGeometry(0.13, 0.34, 4, 8);
  kit.geos.push(riderGeo1);
  const torso = new THREE.Mesh(riderGeo1, jacket);
  torso.position.set(0, 1.02, 0.28);
  torso.rotation.x = -0.28;
  rider.add(torso);
  const riderGeo2 = new THREE.SphereGeometry(0.11, 10, 10);
  kit.geos.push(riderGeo2);
  const head = new THREE.Mesh(riderGeo2, skin);
  head.position.set(0, 1.3, 0.12);
  rider.add(head);
  const armGeo = new THREE.CapsuleGeometry(0.05, 0.38, 4, 6);
  armGeo.rotateX(Math.PI / 2);
  kit.geos.push(armGeo);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, jacket);
    arm.position.set(sx * 0.16, 1.0, 0.05);
    arm.rotation.y = sx * 0.25;
    rider.add(arm);
  }
  g.add(rider);
  return finish(kit, g, 0.4);
}

export function getVehicleTemplate(kind: VehicleKind): Template {
  let t = templates.get(kind);
  if (!t) {
    const spec = VEHICLE_SPECS[kind];
    const kit = makeKit(spec);
    const model =
      kind === 'coupe'
        ? buildCoupe(kit)
        : kind === 'supercar'
          ? buildSupercar(kit)
          : kind === 'suv'
            ? buildSuv(kit)
            : kind === 'van'
              ? buildVan(kit)
              : kind === 'moto'
                ? buildMoto(kit)
                : buildSedan(kit); // sedan + taxi share the three-box silhouette
    t = {
      model,
      geometries: kit.geos,
      materials: [...Object.values(kit.mats), ...kit.extra],
      bodyMaterial: kit.mats.body,
    };
    templates.set(kind, t);
  }
  return t;
}

/** Deep clone sharing template geometry & materials (no per-car GPU dupes). */
export function instantiateVehicleModel(kind: VehicleKind, bodyTint?: number): VehicleModel {
  const t = getVehicleTemplate(kind);
  const root = t.model.root.clone(true);
  if (bodyTint !== undefined) {
    const tinted = (t.bodyMaterial as THREE.MeshStandardMaterial).clone();
    tinted.color.setHex(bodyTint);
    tinted.userData.isTint = true;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (Array.isArray(mesh.material)) return;
      if (mesh.material === t.bodyMaterial) mesh.material = tinted;
    });
  }
  const wheels = WHEEL_NAMES.map((n) => root.getObjectByName(n) ?? new THREE.Object3D());
  const spins = wheels.map((w) => w.getObjectByName('spin') ?? w);
  return { root, wheels, spins, steeringWheel: root.getObjectByName('steering-wheel') ?? null };
}

export function disposeVehicleTemplates(): void {
  templates.forEach((t) => {
    t.geometries.forEach((geo) => geo.dispose());
    t.materials.forEach((m) => m.dispose());
  });
  templates.clear();
  lightMats.length = 0;
}
