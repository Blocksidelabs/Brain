import { EventBus } from '../../engine/EventBus';

export type MissionId = 'explore' | 'first_car' | 'delivery' | 'race';
export type MissionStatus = 'locked' | 'available' | 'active' | 'completed' | 'failed';

export interface MissionObjective {
  id: string;
  description: string;
  target?: { x: number; y: number; z: number; radius: number };
  requiresVehicle?: boolean;
  timeLimit?: number;
}

export interface MissionDef {
  id: MissionId;
  title: string;
  description: string;
  reward: number;
  objectives: MissionObjective[];
  unlocks?: MissionId[];
}

export interface MissionState {
  id: MissionId;
  status: MissionStatus;
  objectiveIndex: number;
  timeLeft: number;
}

export const MISSIONS: Record<MissionId, MissionDef> = {
  explore: {
    id: 'explore', title: 'Welcome to the City', description: 'Walk to the plaza.', reward: 100,
    objectives: [{ id: 'reach_plaza', description: 'Reach the Downtown Plaza', target: { x: 40, y: 0, z: -40, radius: 10 } }],
    unlocks: ['first_car'],
  },
  first_car: {
    id: 'first_car', title: 'Wheels', description: 'Find some wheels.', reward: 250,
    objectives: [
      { id: 'enter_veh', description: 'Enter a vehicle', requiresVehicle: true },
      { id: 'drive_50', description: 'Drive 50 meters' },
    ],
    unlocks: ['delivery'],
  },
  delivery: {
    id: 'delivery', title: 'Hot Package', description: 'Deliver the package.', reward: 500,
    objectives: [
      { id: 'pickup', description: 'Pick up package downtown', target: { x: 4.5, y: 0, z: -22, radius: 8 }, requiresVehicle: true },
      { id: 'dropoff', description: 'Deliver to Docks', target: { x: -235, y: 0, z: 44, radius: 12 }, requiresVehicle: true, timeLimit: 90 },
    ],
    unlocks: ['race'],
  },
  race: {
    id: 'race', title: 'Neon Run', description: 'Win the race.', reward: 1000,
    objectives: [
      { id: 'cp1', description: 'CP 1', target: { x: 0, y: 0, z: 160, radius: 12 }, requiresVehicle: true },
      { id: 'cp2', description: 'CP 2', target: { x: 160, y: 0, z: 160, radius: 12 }, requiresVehicle: true },
      { id: 'cp3', description: 'CP 3', target: { x: 160, y: 0, z: 0, radius: 12 }, requiresVehicle: true },
      { id: 'cp4', description: 'Finish', target: { x: 40, y: 0, z: -40, radius: 12 }, requiresVehicle: true, timeLimit: 60 },
    ],
  },
};

export class MissionManager {
  private states = new Map<MissionId, MissionState>();
  private bus: EventBus;
  private distanceDriven = 0;
  private lastPos = { x: 0, z: 0 };

  constructor(bus: EventBus) {
    this.bus = bus;
    this.states.set('explore', { id: 'explore', status: 'available', objectiveIndex: 0, timeLeft: 0 });
  }

  start(id: MissionId): void {
    const state = this.states.get(id);
    if (!state || state.status !== 'available') return;
    state.status = 'active';
    state.objectiveIndex = 0;
    state.timeLeft = MISSIONS[id].objectives[0].timeLimit ?? 0;
    this.bus.emit('mission:started', id);
    this.bus.emit('mission:updated', this.getHudData());
  }

  update(dt: number, playerPos: { x: number; z: number }, inVehicle: boolean): void {
    for (const state of this.states.values()) {
      if (state.status !== 'active') continue;
      const def = MISSIONS[state.id];
      const obj = def.objectives[state.objectiveIndex];
      if (!obj) continue;

      if (obj.timeLimit) {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) { this.fail(state.id); continue; }
      }

      if (obj.id === 'drive_50' && inVehicle) {
        const dx = playerPos.x - this.lastPos.x;
        const dz = playerPos.z - this.lastPos.z;
        this.distanceDriven += Math.sqrt(dx * dx + dz * dz);
        this.lastPos.x = playerPos.x;
        this.lastPos.z = playerPos.z;
        if (this.distanceDriven >= 50) this.completeObjective(state);
      }

      if (obj.target) {
        const dist = Math.hypot(playerPos.x - obj.target.x, playerPos.z - obj.target.z);
        if (dist < obj.target.radius) this.completeObjective(state);
      }
    }
  }

  notifyVehicleState(active: boolean, pos: { x: number; z: number }): void {
    if (active) { this.lastPos.x = pos.x; this.lastPos.z = pos.z; }
    // Auto-complete "enter vehicle" objectives
    for (const state of this.states.values()) {
      if (state.status !== 'active') continue;
      const obj = MISSIONS[state.id].objectives[state.objectiveIndex];
      if (obj.requiresVehicle && obj.id === 'enter_veh' && active) {
        this.completeObjective(state);
      }
    }
  }

  private completeObjective(state: MissionState): void {
    const def = MISSIONS[state.id];
    state.objectiveIndex++;
    if (state.objectiveIndex >= def.objectives.length) {
      this.complete(state.id);
    } else {
      const next = def.objectives[state.objectiveIndex];
      state.timeLeft = next.timeLimit ?? 0;
      this.bus.emit('mission:updated', this.getHudData());
    }
  }

  private complete(id: MissionId): void {
    const state = this.states.get(id);
    if (!state) return;
    state.status = 'completed';
    const def = MISSIONS[id];
    this.bus.emit('mission:completed', { id, reward: def.reward });
    this.bus.emit('mission:updated', this.getHudData());
    if (def.unlocks) {
      for (const nId of def.unlocks) {
        if (!this.states.has(nId)) {
          this.states.set(nId, { id: nId, status: 'available', objectiveIndex: 0, timeLeft: 0 });
        }
      }
    }
  }

  private fail(id: MissionId): void {
    const state = this.states.get(id);
    if (!state) return;
    state.status = 'available'; // Allow retry
    state.objectiveIndex = 0;
    this.bus.emit('mission:failed', id);
    this.bus.emit('mission:updated', this.getHudData());
  }

  getHudData(): { title: string; objective: string; timeLeft: number } | null {
    for (const state of this.states.values()) {
      if (state.status === 'active') {
        const def = MISSIONS[state.id];
        const obj = def.objectives[state.objectiveIndex];
        return { title: def.title, objective: obj ? obj.description : '', timeLeft: state.timeLeft };
      }
    }
    return null;
  }
}

