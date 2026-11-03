import RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER } from '../config/gameConfig';

export interface CharacterActor {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Owns the Rapier world, fixed-step stepping and collider creation helpers. */
export class PhysicsManager {
  world!: RAPIER.World;
  private accumulator = 0;

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
  }

  /** Fixed-timestep stepping with a capped substep count. */
  step(dt: number): void {
    this.accumulator = Math.min(this.accumulator + dt, 0.12);
    const h = this.world.timestep;
    while (this.accumulator >= h) {
      this.world.step();
      this.accumulator -= h;
    }
  }

  addStaticBox(center: Vec3, halfExtents: Vec3): RAPIER.Collider {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
    );
    return this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
      body,
    );
  }

  createCharacter(x: number, y: number, z: number): CharacterActor {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER.halfHeight, PLAYER.radius).setTranslation(
        0,
        PLAYER.halfHeight + PLAYER.radius,
        0,
      ),
      body,
    );
    const controller = this.world.createCharacterController(0.06);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((45 * Math.PI) / 180);
    controller.enableAutostep(0.5, 0.2, true);
    controller.enableSnapToGround(0.5);
    controller.setApplyImpulsesToDynamicBodies(false);
    return { body, collider, controller };
  }

  /** Distance to the first collider hit along a normalized ray, or null. */
  rayDistance(origin: Vec3, dir: Vec3, maxToi: number, excludeBody?: RAPIER.RigidBody): number | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRay(ray, maxToi, true, undefined, undefined, undefined, excludeBody);
    if (!hit) return null;
    const t = hit as unknown as { timeOfImpact?: number; toi?: number };
    return t.timeOfImpact ?? t.toi ?? null;
  }

  dispose(): void {
    (this.world as unknown as { free?: () => void }).free?.();
  }
}
