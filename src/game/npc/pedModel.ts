import * as THREE from 'three';
import { mulberry32, type Rng } from '../../engine/mathUtils';

export interface PedRig {
  root: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  torso: THREE.Mesh;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
}

const SKINS = [0xd8a37a, 0xb98455, 0x8a5a34, 0xe6b98f, 0x6e4526];
const SHIRTS = [0xff5c8a, 0x35e0ff, 0xffd23c, 0x2ec4b6, 0xf2f2f2, 0x9d4edd, 0x2a3245, 0xe86a3c, 0x7ddc8f, 0xc43b52];
const PANTS = [0x2a3245, 0x1b1e2c, 0x4a4034, 0x37474f, 0x5a4a6a];
const HAIRS = [0x1a1210, 0x3a2a1a, 0x6b4a2a, 0x999080, 0x2a2a2e];

/** Procedural pedestrian with two-segment limbs and randomised appearance. */
export function buildPedestrian(seed: number): PedRig {
  const rng: Rng = mulberry32(seed);
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(rng() * SKINS.length)], roughness: 0.65 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)], roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)], roughness: 0.9 });
  const hairM = new THREE.MeshStandardMaterial({ color: HAIRS[Math.floor(rng() * HAIRS.length)], roughness: 0.95 });
  const shoeM = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.7 });
  const materials = [skin, shirt, pants, hairM, shoeM];

  const root = new THREE.Group();
  root.scale.setScalar(0.92 + rng() * 0.18);
  const geometries: THREE.BufferGeometry[] = [];
  const add = (mesh: THREE.Mesh, parent: THREE.Object3D): THREE.Mesh => {
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const pelvisGeo = new THREE.CapsuleGeometry(0.16, 0.1, 4, 8);
  const torsoGeo = new THREE.CapsuleGeometry(0.19, 0.34, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const hairGeo = new THREE.SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
  geometries.push(pelvisGeo, torsoGeo, headGeo, hairGeo);

  const pelvis = add(new THREE.Mesh(pelvisGeo, pants), root);
  pelvis.position.y = 0.94;
  const torso = add(new THREE.Mesh(torsoGeo, shirt), root);
  torso.position.y = 1.22;
  torso.scale.set(1.1, 1, 0.75);
  const headG = new THREE.Group();
  headG.position.y = 1.52;
  root.add(headG);
  add(new THREE.Mesh(headGeo, skin), headG);
  const hair = new THREE.Mesh(hairGeo, hairM);
  hair.position.y = 0.02;
  headG.add(hair);

  const thighGeo = new THREE.CapsuleGeometry(0.075, 0.3, 4, 8);
  thighGeo.translate(0, -0.18, 0);
  const shinGeo = new THREE.CapsuleGeometry(0.06, 0.3, 4, 8);
  shinGeo.translate(0, -0.17, 0);
  const footGeo = new THREE.BoxGeometry(0.09, 0.06, 0.22);
  const upperArmGeo = new THREE.CapsuleGeometry(0.055, 0.26, 4, 8);
  upperArmGeo.translate(0, -0.15, 0);
  const foreArmGeo = new THREE.CapsuleGeometry(0.05, 0.24, 4, 8);
  foreArmGeo.translate(0, -0.14, 0);
  const handGeo = new THREE.SphereGeometry(0.05, 8, 8);
  geometries.push(thighGeo, shinGeo, footGeo, upperArmGeo, foreArmGeo, handGeo);

  const makeLeg = (sx: number): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.1, 0.92, 0);
    add(new THREE.Mesh(thighGeo, pants), hip);
    const knee = new THREE.Group();
    knee.position.set(0, -0.38, 0);
    add(new THREE.Mesh(shinGeo, pants), knee);
    const foot = new THREE.Mesh(footGeo, shoeM);
    foot.position.set(0, -0.36, -0.04);
    knee.add(foot);
    hip.add(knee);
    root.add(hip);
    return { hip, knee };
  };
  const makeArm = (sx: number): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.26, 1.4, 0);
    add(new THREE.Mesh(upperArmGeo, shirt), shoulder);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.33, 0);
    add(new THREE.Mesh(foreArmGeo, skin), elbow);
    const hand = new THREE.Mesh(handGeo, skin);
    hand.position.set(0, -0.3, 0);
    elbow.add(hand);
    shoulder.add(elbow);
    root.add(shoulder);
    return { shoulder, elbow };
  };

  const legLPair = makeLeg(1);
  const legRPair = makeLeg(-1);
  const armLPair = makeArm(1);
  const armRPair = makeArm(-1);

  const rig: PedRig = {
    root,
    legL: legLPair.hip,
    legR: legRPair.hip,
    kneeL: legLPair.knee,
    kneeR: legRPair.knee,
    armL: armLPair.shoulder,
    armR: armRPair.shoulder,
    elbowL: armLPair.elbow,
    elbowR: armRPair.elbow,
    torso,
    materials,
    geometries,
  };

  return rig;
}
