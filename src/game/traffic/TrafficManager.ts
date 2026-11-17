import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { clamp, dampAngle } from '../../engine/mathUtils';
import type { PhysicsManager } from '../../engine/PhysicsManager';
import { instantiateVehicleModel, type VehicleModel } from '../vehicles/vehicleModels';
import { VEHICLE_SPECS, type VehicleKind } from '../vehicles/vehicleTypes';
import { type RoadEdge, type RoadGraph, type TrafficLights } from '../network/cityNetwork';

const AI_COLORS = [0xf2f2f2, 0x1b1e2c, 0x9aa3ad, 0xb43a3a, 0x2ec4b6, 0x5a6acf, 0xd8c74a, 0x8a5a34];
const TRAFFIC_KINDS: VehicleKind[] = ['sedan', 'sedan', 'taxi', 'suv', 'coupe', 'van', 'moto', 'sedan'];
const DESPAWN_DIST = 190;
const SPAWN_MIN = 55;
const SPAWN_MAX = 170;

interface PoolEntry {
  kind: VehicleKind;
  model: VehicleModel;
  body: RAPIER.RigidBody;
  tint: THREE.MeshStandardMaterial;
}

class AICar {
  edge!: RoadEdge;
  model!: VehicleModel;
  body!: RAPIER.RigidBody;
  kind: VehicleKind;
  t = 0;
  dirX = 0;
  dirZ = 0;
  speed = 0;
  cruise: number;
  pos = new THREE.Vector3();
  private heading = 0;
  private segStart = new THREE.Vector3();
  private segEnd = new THREE.Vector3();
  private segIdx = 0;
  private segLen = 1;
  private segAcc = 0;
  private wheelSpin = 0;
  private segLens: number[] = [];

  constructor(
    kind: VehicleKind,
    tint: number,
    physics: PhysicsManager,
    scene: THREE.Scene,
  ) {
    this.kind = kind;
    this.model = instantiateVehicleModel(kind, tint);
    this.cruise = 7.5 + VEHICLE_SPECS[kind].maxSpeed * 0.06;
    scene.add(this.model.root);
    const spec = VEHICLE_SPECS[kind];
    this.body = physics.createKinematicBox(0, 0.6, 0, {
      x: spec.bodyHalf.x,
      y: 0.7,
      z: spec.bodyHalf.z,
    });
  }

  setEdge(edge: RoadEdge): void {
    this.edge = edge;
    this.t = 0;
    this.segLens = [];
    let acc = 0;
    for (let i = 1; i < edge.points.length; i++) {
      const l = Math.hypot(edge.points[i].x - edge.points[i - 1].x, edge.points[i].z - edge.points[i - 1].z);
      this.segLens.push(l);
      acc += l;
    }
    this.segIdx = 0;
    this.segAcc = 0;
    this.segStart.set(edge.points[0].x, 0, edge.points[0].z);
    this.segEnd.set(edge.points[1].x, 0, edge.points[1].z);
    this.pos.set(this.segStart.x, 0, this.segStart.z);
    this.speed *= 0.5;
    this.body.setTranslation({ x: this.pos.x, y: 0.6, z: this.pos.z }, true);
    void acc;
  }

  /** Returns true when the edge is finished (needs a new one). */
  update(dt: number, targetSpeed: number): boolean {
    this.speed += clamp(targetSpeed - this.speed, -9 * dt, 4.4 * dt);
    if (targetSpeed < 0.05 && this.speed < 0.25) this.speed = 0;
    this.t += this.speed * dt;
    while (this.t > this.segAcc + this.segLens[this.segIdx] && this.segIdx < this.segLens.length - 1) {
      this.segAcc += this.segLens[this.segIdx];
      this.segIdx++;
      this.segStart.set(this.edge.points[this.segIdx].x, 0, this.edge.points[this.segIdx].z);
      this.segEnd.set(this.edge.points[this.segIdx + 1].x, 0, this.edge.points[this.segIdx + 1].z);
    }
    if (this.t >= this.edge.length) return true;

    const segT = this.t - this.segAcc;
    const inv = 1 / this.segLen;
    this.pos.set(
      this.segStart.x + (this.segEnd.x - this.segStart.x) * segT * inv,
      0,
      this.segStart.z + (this.segEnd.z - this.segStart.z) * segT * inv,
    );
    const dirX = (this.segEnd.x - this.segStart.x) * inv;
    const dirZ = (this.segEnd.z - this.segStart.z) * inv;
    this.dirX = dirX;
    this.dirZ = dirZ;
    const targetHeading = Math.atan2(-dirX, -dirZ);
    this.heading = dampAngle(this.heading, targetHeading, 10, dt);

    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.heading;
    const frontSteer = clamp((targetHeading - this.heading) * 2, -0.5, 0.5);
    this.model.wheels[0].rotation.y = frontSteer;
    this.model.wheels[1].rotation.y = frontSteer;
    this.wheelSpin += (this.speed / VEHICLE_SPECS[this.kind].wheelRadius) * dt;
    for (const spin of this.model.spins) spin.rotation.x = -this.wheelSpin;

    this.body.setNextKinematicTranslation({ x: this.pos.x, y: 0.6, z: this.pos.z });
    return false;
  }

  isAheadOf(origin: THREE.Vector3, dirX: number, dirZ: number, maxDist: number): boolean {
    const dx = this.pos.x - origin.x;
    const dz = this.pos.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist || d < 0.001) return false;
    return (dx / d) * dirX + (dz / d) * dirZ > 0.55;
  }
}

export interface TrafficSnapshot {
  count: number;
  positions: number[][];
}

/**
 * Kinematic AI traffic on the road graph: lanes, traffic lights,
 * car-following gaps, pedestrian and player yielding. Bodies are kinematic
 * boxes (cheap; the player's dynamic car bounces off them). Population is
 * distance-based with object pooling.
 */
export class TrafficManager {
  private cars: AICar[] = [];
  private pool: PoolEntry[] = [];
  private spawnTimer = 0;
  private rngState = 13579;

  constructor(
    private physics: PhysicsManager,
    private scene: THREE.Scene,
    private graph: RoadGraph,
    private lights: TrafficLights,
  ) {}

  private rng(): number {
    this.rngState = (this.rngState * 1664525 + 1013904223) | 0;
    return ((this.rngState >>> 8) & 0xffffff) / 0xffffff;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerCarPos: THREE.Vector3 | null,
    peds: Array<{ x: number; z: number }>,
    cap: number,
  ): void {
    this.lights.update(dt);

    for (let i = this.cars.length - 1; i >= 0; i--) {
      if (this.cars[i].pos.distanceTo(playerPos) > DESPAWN_DIST) this.recycle(i);
    }
    this.spawnTimer -= dt;
    if (this.cars.length < cap && this.spawnTimer <= 0) {
      this.spawnTimer = 0.5;
      this.trySpawn(playerPos);
    }

    const byEdge = new Map<number, AICar[]>();
    for (const car of this.cars) {
      const list = byEdge.get(car.edge.id);
      if (list) list.push(car);
      else byEdge.set(car.edge.id, [car]);
    }

    for (const [, list] of byEdge) {
      list.sort((a, b) => a.t - b.t);
      for (let i = 0; i < list.length; i++) {
        const car = list[i];
        const ahead = list[(i + 1) % list.length];
        const wrapped = i === list.length - 1;
        const gap = wrapped ? car.edge.length - car.t + ahead.t : ahead.t - car.t;

        let target = car.cruise;
        const remaining = car.edge.length - car.t;

        if (car.edge.signalized && remaining < 16) {
          const endNode = this.graph.nodes[car.edge.endNode];
          if (!this.lights.allows(car.edge.axis, endNode.kx, endNode.kz)) {
            target = Math.min(target, Math.sqrt(2 * 5.5 * Math.max(0.1, remaining)));
          }
        }
        if (remaining < 11) target = Math.min(target, 5.6);
        if (!wrapped && gap < 15) {
          target = Math.min(target, Math.max(0, ahead.speed + (gap - 5.5) * 0.8));
        } else if (wrapped && gap < 8) {
          target = Math.min(target, Math.max(0, ahead.speed + (gap - 5.5) * 0.8));
        }
        target = this.checkBlockers(car, target, playerCarPos, peds);

        if (car.update(dt, target)) {
          const endNode = this.graph.nodes[car.edge.endNode];
          const options = endNode.out;
          const a = options[Math.floor(this.rng() * options.length)];
          const b = options[Math.floor(this.rng() * options.length)];
          const chosen = this.graph.edges[a].axis === car.edge.axis ? a : b;
          car.setEdge(this.graph.edges[chosen]);
        }
      }
    }
  }

  /** Slow/stop for the player's car and pedestrians ahead of us. */
  private checkBlockers(
    car: AICar,
    target: number,
    playerCarPos: THREE.Vector3 | null,
    peds: Array<{ x: number; z: number }>,
  ): number {
    const nx = car.dirX;
    const nz = car.dirZ;
    let result = target;

    if (playerCarPos) {
      const dx = playerCarPos.x - car.pos.x;
      const dz = playerCarPos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 9 && d > 0.001) {
        const dot = (dx / d) * nx + (dz / d) * nz;
        if (dot > 0.5) result = Math.min(result, Math.max(0, (d - 5) * 1.1));
      }
    }
    for (const ped of peds) {
      const dx = ped.x - car.pos.x;
      const dz = ped.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 6 && d > 0.001) {
        const dot = (dx / d) * nx + (dz / d) * nz;
        if (dot > 0.4) {
          result = d < 3.5 ? 0 : Math.min(result, Math.max(0, (d - 3.5) * 1.4));
        }
      }
    }
    return result;
  }

  private trySpawn(playerPos: THREE.Vector3): void {
    let edge: RoadEdge | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const node = this.graph.nodes[Math.floor(this.rng() * this.graph.nodes.length)];
      const d = Math.hypot(node.x - playerPos.x, node.z - playerPos.z);
      if (d < SPAWN_MIN || d > SPAWN_MAX) continue;
      if (node.out.length === 0) continue;
      const candidate = this.graph.edges[node.out[Math.floor(this.rng() * node.out.length)]];
      const start = candidate.points[0];
      if (Math.hypot(start.x - playerPos.x, start.z - playerPos.z) < 45) continue;
      let blocked = false;
      for (const car of this.cars) {
        if (car.edge.id === candidate.id && car.t < 14) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        edge = candidate;
        break;
      }
    }
    if (!edge) return;

    const poolEntry = this.pool.pop();
    if (poolEntry) {
      poolEntry.body.setEnabled(true);
      poolEntry.model.root.visible = true;
      const car = new AICar(poolEntry.kind, 0, this.physics, this.scene);
      car.model = poolEntry.model;
      car.body = poolEntry.body;
      car.setEdge(edge);
      this.cars.push(car);
      return;
    }
    const kind = TRAFFIC_KINDS[Math.floor(this.rng() * TRAFFIC_KINDS.length)];
    const tint = AI_COLORS[Math.floor(this.rng() * AI_COLORS.length)];
    const car = new AICar(kind, tint, this.physics, this.scene);
    car.setEdge(edge);
    this.cars.push(car);
  }

  private recycle(index: number): void {
    const car = this.cars[index];
    car.model.root.visible = false;
    car.body.setEnabled(false);
    this.pool.push({ kind: car.kind, model: car.model, body: car.body, tint: null as never });
    this.cars.splice(index, 1);
  }

  /** Debug/e2e snapshot: live count plus a few sample positions. */
  getSnapshot(): TrafficSnapshot {
    return {
      count: this.cars.length,
      positions: this.cars.slice(0, 3).map((c) => [c.pos.x, c.pos.z]),
    };
  }

  dispose(): void {
    const kill = (model: VehicleModel, body: RAPIER.RigidBody): void => {
      this.scene.remove(model.root);
      body.setEnabled(false);
      model.root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!Array.isArray(mesh.material) && (mesh.material as THREE.MeshStandardMaterial)?.userData?.isTint) {
          mesh.material.dispose();
        }
      });
    };
    for (const entry of this.pool) kill(entry.model, entry.body);
    for (const car of this.cars) kill(car.model, car.body);
    this.cars = [];
    this.pool = [];
  }
}
