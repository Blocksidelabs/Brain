import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsManager } from '../../engine/PhysicsManager';
import { blockZone } from '../city/zones';
import { pedWeight, type PedNetwork } from '../network/cityNetwork';
import { buildPedestrian, type PedRig } from './pedModel';

const DESPAWN_DIST = 160;
const SPAWN_MIN = 45;
const SPAWN_MAX = 140;
const WALK_MIN = 1.0;
const WALK_MAX = 1.75;

interface PoolEntry {
  rig: PedRig;
  body: RAPIER.RigidBody;
}

class Pedestrian {
  pos = new THREE.Vector3();
  private from: number;
  private to: number;
  private segLen: number;
  private t = 0;
  private speed: number;
  private phase: number;
  private state: 'walk' | 'idle' = 'walk';
  private idleT = 0;
  private heading = 0;

  constructor(
    private net: PedNetwork,
    public rig: PedRig,
    public body: RAPIER.RigidBody,
    private rng: () => number,
    startNode: number,
  ) {
    this.from = startNode;
    this.to = this.pickNext(startNode, -1);
    const a = net.nodes[this.from];
    const b = net.nodes[this.to];
    this.segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    this.speed = WALK_MIN + rng() * (WALK_MAX - WALK_MIN);
    this.phase = rng() * Math.PI * 2;
    this.pos.set(a.x, 0, a.z);
    rig.root.position.copy(this.pos);
  }

  private pickNext(from: number, avoid: number): number {
    const links = this.net.nodes[from].links;
    const options = links.filter((l) => l !== avoid);
    const list = options.length ? options : links;
    return list[Math.floor(this.rng() * list.length)];
  }

  update(dt: number, playerPos: THREE.Vector3, peds: Pedestrian[]): void {
    if (this.state === 'idle') {
      this.idleT -= dt;
      if (this.idleT <= 0) this.state = 'walk';
      const sway = Math.sin(this.phase * 3) * 0.04;
      this.rig.armL.rotation.x = sway;
      this.rig.armR.rotation.x = -sway;
      this.syncBody();
      return;
    }

    const a = this.net.nodes[this.from];
    const b = this.net.nodes[this.to];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const inv = 1 / this.segLen;

    // separation from other pedestrians
    let sepX = 0;
    let sepZ = 0;
    for (const other of peds) {
      if (other === this) continue;
      const ox = other.pos.x - this.pos.x;
      const oz = other.pos.z - this.pos.z;
      const d2 = ox * ox + oz * oz;
      if (d2 > 0.0001 && d2 < 0.64) {
        const d = Math.sqrt(d2);
        const push = ((0.8 - d) / 0.8) * 0.45;
        sepX -= (ox / d) * push;
        sepZ -= (oz / d) * push;
      }
    }
    // react to the player: sidestep when they get close
    const pdx = this.pos.x - playerPos.x;
    const pdz = this.pos.z - playerPos.z;
    const pd = Math.hypot(pdx, pdz);
    if (pd < 2.4 && pd > 0.01) {
      const push = ((2.4 - pd) / 2.4) * 0.5;
      sepX += (pdx / pd) * push;
      sepZ += (pdz / pd) * push;
    }

    this.t += this.speed * dt;
    if (this.t >= this.segLen) {
      const next = this.pickNext(this.to, this.from);
      if (this.rng() < 0.07) {
        this.state = 'idle';
        this.idleT = 1.2 + this.rng() * 3;
      }
      this.t = 0;
      this.from = this.to;
      this.to = next;
      const na = this.net.nodes[this.from];
      const nb = this.net.nodes[this.to];
      this.segLen = Math.hypot(nb.x - na.x, nb.z - na.z) || 1;
      return;
    }

    const px = a.x + dx * inv * this.t;
    const pz = a.z + dz * inv * this.t;
    this.pos.set(px + sepX, 0, pz + sepZ);

    const targetHeading = Math.atan2(-(dx * inv + sepX), -(dz * inv + sepZ));
    let dH = targetHeading - this.heading;
    while (dH > Math.PI) dH -= Math.PI * 2;
    while (dH < -Math.PI) dH += Math.PI * 2;
    this.heading += dH * Math.min(1, dt * 8);

    this.phase += this.speed * dt * 2.7;
    const s = Math.sin(this.phase);
    this.rig.legL.rotation.x = -s * 0.55;
    this.rig.legR.rotation.x = s * 0.55;
    this.rig.kneeL.rotation.x = 0.06 + Math.max(0, s) * 0.75;
    this.rig.kneeR.rotation.x = 0.06 + Math.max(0, -s) * 0.75;
    this.rig.armL.rotation.x = s * 0.5;
    this.rig.armR.rotation.x = -s * 0.5;
    this.rig.elbowL.rotation.x = -0.25;
    this.rig.elbowR.rotation.x = -0.25;
    this.rig.root.rotation.y = this.heading;
    this.rig.root.position.copy(this.pos);
    this.syncBody();
  }

  private syncBody(): void {
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: 0.9, z: this.pos.z });
  }
}

export interface PedSnapshot {
  count: number;
  positions: number[][];
}

/**
 * Distance-based pedestrian population: peds spawn on the sidewalk network
 * 45–140 m from the player (weighted by district), despawn beyond 160 m and
 * are recycled through an object pool. Each pedestrian walks the sidewalk
 * graph, crosses at crosswalks, separates from others and sidesteps the
 * player.
 */
export class NPCManager {
  private peds: Pedestrian[] = [];
  private pool: PoolEntry[] = [];
  private spawnTimer = 0;
  private nodeWeights: number[] = [];
  private rngState = 987654321;

  constructor(
    private physics: PhysicsManager,
    private scene: THREE.Scene,
    private net: PedNetwork,
  ) {
    for (const node of net.nodes) {
      const bx = node.block % 8;
      const bz = Math.floor(node.block / 8);
      this.nodeWeights.push(pedWeight(blockZone(bx, bz)));
    }
  }

  private rng(): number {
    this.rngState = (this.rngState * 1664525 + 1013904223) | 0;
    return ((this.rngState >>> 8) & 0xffffff) / 0xffffff;
  }

  update(dt: number, playerPos: THREE.Vector3, cap: number): void {
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const ped = this.peds[i];
      if (ped.pos.distanceTo(playerPos) > DESPAWN_DIST) this.recycle(i);
    }
    this.spawnTimer -= dt;
    if (this.peds.length < cap && this.spawnTimer <= 0) {
      this.spawnTimer = 0.35;
      this.trySpawn(playerPos);
    }
    for (const ped of this.peds) ped.update(dt, playerPos, this.peds);
  }

  private trySpawn(playerPos: THREE.Vector3): void {
    let best = -1;
    let bestScore = -1;
    for (let attempt = 0; attempt < 8; attempt++) {
      const id = Math.floor(this.rng() * this.net.nodes.length);
      const node = this.net.nodes[id];
      const d = Math.hypot(node.x - playerPos.x, node.z - playerPos.z);
      if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
      const score = this.nodeWeights[id] * (0.6 + this.rng() * 0.8);
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    if (best < 0) return;
    const node = this.net.nodes[best];
    const poolEntry = this.pool.pop();
    let rig: PedRig;
    let body: RAPIER.RigidBody;
    if (poolEntry) {
      rig = poolEntry.rig;
      body = poolEntry.body;
      body.setEnabled(true);
      rig.root.visible = true;
    } else {
      rig = buildPedestrian(Math.floor(this.rng() * 1e9));
      body = this.physics.createKinematicCapsule(node.x, node.z);
      this.scene.add(rig.root);
    }
    body.setTranslation({ x: node.x, y: 0.9, z: node.z }, true);
    this.peds.push(new Pedestrian(this.net, rig, body, () => this.rng(), best));
  }

  private recycle(index: number): void {
    const ped = this.peds[index];
    ped.rig.root.visible = false;
    ped.body.setEnabled(false);
    this.pool.push({ rig: ped.rig, body: ped.body });
    this.peds.splice(index, 1);
  }

  /** Returns positions of ALL active pedestrians (for AI traffic awareness). */
  getPedPoints(): Array<{ x: number; z: number }> {
    return this.peds.map((p) => ({ x: p.pos.x, z: p.pos.z }));
  }

  /** Debug/e2e snapshot: live count plus a few sample positions. */
  getSnapshot(): PedSnapshot {
    return {
      count: this.peds.length,
      positions: this.peds.slice(0, 3).map((p) => [p.pos.x, p.pos.z]),
    };
  }

  dispose(): void {
    for (const ped of this.peds) {
      ped.rig.root.visible = false;
      ped.body.setEnabled(false);
      this.pool.push({ rig: ped.rig, body: ped.body });
    }
    this.peds = [];
    for (const entry of this.pool) {
      this.scene.remove(entry.rig.root);
      entry.body.setEnabled(false);
      entry.rig.geometries.forEach((g) => g.dispose());
      entry.rig.materials.forEach((m) => m.dispose());
    }
    this.pool = [];
  }
}

