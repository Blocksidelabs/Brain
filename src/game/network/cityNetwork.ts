import { CITY } from '../../config/gameConfig';
import { blockCenter, type ZoneId } from '../city/zones';

/** Lane centre offset from the road axis (right-hand traffic). */
export const LANE_OFFSET = 4;
/** Vehicles stop this far before an intersection centre. */
export const STOP_INSET = 7;
/** Traffic re-enters the road this far after an intersection centre. */
export const EXIT_INSET = 3;
/** Sidewalk path inset from the lot edge. */
export const SIDEWALK_INSET = 1.5;

export interface RoadPathPoint {
  x: number;
  z: number;
}

export interface RoadEdge {
  id: number;
  /** polyline in world space (lane-centred; turns cut the corner) */
  points: RoadPathPoint[];
  length: number;
  /** node id the edge arrives at (the next stop point) */
  endNode: number;
  /** 0 = along z (vertical road), 1 = along x (horizontal road) */
  axis: 0 | 1;
  /**
   * true when the edge ends at a signalized interior intersection — AI must
   * stop at the last point while the light for its axis is red/yellow.
   */
  signalized: boolean;
}

export interface RoadNode {
  x: number;
  z: number;
  kx: number;
  kz: number;
  /** 0 = vertical road (moves along z), 1 = horizontal (moves along x) */
  axis: 0 | 1;
  /** movement sign along the axis */
  dir: 1 | -1;
  out: number[];
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export const GRID_N = CITY.grid + 1; // 9 intersection lines per axis

export function roadCoord(k: number): number {
  return -320 + k * CITY.pitch;
}

export function isInterior(kx: number, kz: number): boolean {
  return kx >= 1 && kx <= 7 && kz >= 1 && kz <= 7;
}

type AxisDir = { axis: 0 | 1; dir: 1 | -1 };

function stopPoint(kx: number, kz: number, axis: 0 | 1, dir: 1 | -1): RoadPathPoint {
  const X = roadCoord(kx);
  const Z = roadCoord(kz);
  if (axis === 0) {
    // vertical road: southbound (dir=+1) keeps west (−x), northbound east
    return { x: X + (dir === 1 ? -LANE_OFFSET : LANE_OFFSET), z: Z - dir * STOP_INSET };
  }
  // horizontal road: eastbound (dir=+1) keeps south (+z), westbound north
  return { x: X - dir * STOP_INSET, z: Z + (dir === 1 ? LANE_OFFSET : -LANE_OFFSET) };
}

function exitPoint(kx: number, kz: number, axis: 0 | 1, dir: 1 | -1): RoadPathPoint {
  const X = roadCoord(kx);
  const Z = roadCoord(kz);
  if (axis === 0) return { x: X + (dir === 1 ? -LANE_OFFSET : LANE_OFFSET), z: Z + dir * EXIT_INSET };
  return { x: X + dir * EXIT_INSET, z: Z + (dir === 1 ? LANE_OFFSET : -LANE_OFFSET) };
}

/**
 * Directed lane graph for AI traffic on the city grid.
 *
 * Nodes are lane stop points just before each intersection (4 per
 * intersection = 324). Every edge is a complete lane path from one stop
 * point to the next: it crosses the source intersection (straight, or
 * cutting a left/right corner) then runs the segment to the destination
 * stop point. U-turns do not exist by construction.
 */
export function buildRoadGraph(): RoadGraph {
  const nodes: RoadNode[] = [];
  const edges: RoadEdge[] = [];
  const nodeIndex = new Map<string, number>();
  const key = (kx: number, kz: number, axis: 0 | 1, dir: 1 | -1) => `${kx},${kz},${axis},${dir}`;

  for (let kz = 0; kz < GRID_N; kz++) {
    for (let kx = 0; kx < GRID_N; kx++) {
      for (const axis of [0, 1] as const) {
        for (const dir of [1, -1] as const) {
          nodeIndex.set(key(kx, kz, axis, dir), nodes.length);
          const p = stopPoint(kx, kz, axis, dir);
          nodes.push({ x: p.x, z: p.z, kx, kz, axis, dir, out: [] });
        }
      }
    }
  }

  const stepK = (k: number, d: 1 | -1): number | null => {
    const next = k + d;
    return next < 0 || next > CITY.grid ? null : next;
  };

  for (const node of nodes) {
    const { kx, kz, axis, dir } = node;
    const stopA = { x: node.x, z: node.z };
    // right turn: vertical roads turn against dir, horizontal roads with dir
    const turns: Array<AxisDir & { kind: 'right' | 'left' }> = [
      {
        kind: 'right',
        axis: (axis === 0 ? 1 : 0) as 0 | 1,
        dir: (axis === 0 ? -dir : dir) as 1 | -1,
      },
      {
        kind: 'left',
        axis: (axis === 0 ? 1 : 0) as 0 | 1,
        dir: (axis === 0 ? dir : -dir) as 1 | -1,
      },
    ];

    const pushEdge = (points: RoadPathPoint[], bx: number, bz: number, target: AxisDir, signalized: boolean): void => {
      let length = 0;
      for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      }
      node.out.push(edges.length);
      edges.push({ id: edges.length, points, length, endNode: nodeIndex.get(key(bx, bz, target.axis, target.dir))!, axis: target.axis, signalized });
    };

    // straight through (path is collinear: stop point → next stop point)
    {
      const nextK = stepK(axis === 0 ? kz : kx, dir);
      if (nextK !== null) {
        const bx = axis === 0 ? kx : nextK;
        const bz = axis === 0 ? nextK : kz;
        pushEdge([stopA, stopPoint(bx, bz, axis, dir)], bx, bz, { axis, dir }, isInterior(bx, bz));
      }
    }
    // left / right turns: cut the corner via the exit point of the new lane
    for (const target of turns) {
      const nextK = stepK(target.axis === 0 ? kz : kx, target.dir);
      if (nextK === null) continue;
      const bx = target.axis === 0 ? kx : nextK;
      const bz = target.axis === 0 ? nextK : kz;
      const ex = exitPoint(kx, kz, target.axis, target.dir);
      pushEdge([stopA, { x: ex.x, z: ex.z }, stopPoint(bx, bz, target.axis, target.dir)], bx, bz, target, isInterior(bx, bz));
    }
  }

  return { nodes, edges };
}

export interface PedNode {
  x: number;
  z: number;
  links: number[];
  /** true when the two links cross a road (a painted crosswalk) */
  crossing: boolean;
  /** block index the node belongs to (bz * grid + bx) */
  block: number;
}

export interface PedNetwork {
  nodes: PedNode[];
}

/**
 * Sidewalk network: a walking loop around every city lot (inset from the
 * lot edge, i.e. on the sidewalk) plus painted-crosswalk connections
 * across the roads at every interior intersection.
 */
export function buildPedNetwork(): PedNetwork {
  const nodes: PedNode[] = [];
  const cornerId = new Map<string, number>();
  const offset = CITY.lot / 2 - SIDEWALK_INSET; // 30.5

  const cornerKey = (bx: number, bz: number, sx: 1 | -1, sz: 1 | -1) => `${bx},${bz},${sx},${sz}`;
  const corner = (bx: number, bz: number, sx: 1 | -1, sz: 1 | -1): number => {
    const k = cornerKey(bx, bz, sx, sz);
    const id = cornerId.get(k);
    if (id !== undefined) return id;
    const x = blockCenter(bx) + sx * offset;
    const z = blockCenter(bz) + sz * offset;
    const nid = nodes.length;
    nodes.push({ x, z, links: [], crossing: false, block: bz * CITY.grid + bx });
    cornerId.set(k, nid);
    return nid;
  };

  const link = (a: number, b: number, crossing: boolean): void => {
    if (a === b) return;
    if (!nodes[a].links.includes(b)) nodes[a].links.push(b);
    if (!nodes[b].links.includes(a)) nodes[b].links.push(a);
    if (crossing) {
      nodes[a].crossing = true;
      nodes[b].crossing = true;
    }
  };

  // perimeter loops around every lot
  for (let bz = 0; bz < CITY.grid; bz++) {
    for (let bx = 0; bx < CITY.grid; bx++) {
      const nw = corner(bx, bz, -1, -1);
      const ne = corner(bx, bz, 1, -1);
      const se = corner(bx, bz, 1, 1);
      const sw = corner(bx, bz, -1, 1);
      link(nw, ne, false);
      link(ne, se, false);
      link(se, sw, false);
      link(sw, nw, false);
    }
  }

  // crosswalks across each road arm at interior intersections
  for (let kz = 1; kz <= 7; kz++) {
    for (let kx = 1; kx <= 7; kx++) {
      // across the vertical road kx (west block kx-1 ↔ east block kx)
      link(
        corner(kx - 1, kz - 1, 1, 1), // west block SE corner
        corner(kx, kz - 1, -1, 1), // east block SW corner
        true,
      );
      link(
        corner(kx - 1, kz, 1, -1), // west block NE corner
        corner(kx, kz, -1, -1), // east block NW corner
        true,
      );
      // across the horizontal road kz (north block kz-1 ↔ south block kz)
      link(
        corner(kx - 1, kz - 1, 1, 1), // north block SE corner (west side)
        corner(kx - 1, kz, 1, -1), // south block NE corner (west side)
        true,
      );
      link(
        corner(kx, kz - 1, -1, 1), // north block SW corner (east side)
        corner(kx, kz, -1, -1), // south block NW corner (east side)
        true,
      );
    }
  }

  return { nodes };
}

/**
 * Traffic signal controller. Alternate NS/EW phases with a short yellow;
 * intersections offset their phase by (kx + kz) parity for variety.
 * Unsignalized (boundary) intersections always allow traffic.
 */
export const GREEN_TIME = 8;
export const YELLOW_TIME = 2;

export class TrafficLights {
  private t = 0;
  private phaseA = true; // phaseA: vertical (NS) green at parity-even nodes

  update(dt: number): void {
    this.t += dt;
    const cycle = GREEN_TIME + YELLOW_TIME;
    if (this.t >= cycle) {
      this.t -= cycle;
      this.phaseA = !this.phaseA;
    }
  }

  /** true when the axis may proceed at this intersection (yellow = stop). */
  allows(axis: 0 | 1, kx: number, kz: number): boolean {
    if (!isInterior(kx, kz)) return true;
    if (this.t >= GREEN_TIME) return false; // yellow
    const isA = (kx + kz) % 2 === 0;
    const nsGreen = this.phaseA === isA;
    return axis === 0 ? nsGreen : !nsGreen;
  }

  /** Debug/inspection: which axis currently has right of way (no yellow). */
  greenAxis(kx: number, kz: number): 0 | 1 {
    const isA = (kx + kz) % 2 === 0;
    const nsGreen = this.phaseA === isA;
    return nsGreen ? 0 : 1;
  }

  get inYellow(): boolean {
    return this.t >= GREEN_TIME;
  }
}

/** Relative pedestrian density weight per district. */
export function pedWeight(zone: ZoneId): number {
  switch (zone) {
    case 'downtown':
      return 3;
    case 'nightlife':
      return 3;
    case 'beachfront':
      return 2;
    case 'industrial':
      return 0.5;
    default:
      return 1;
  }
}

