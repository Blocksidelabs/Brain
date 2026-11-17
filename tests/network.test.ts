import { describe, expect, it } from 'vitest';
import {
  buildPedNetwork,
  buildRoadGraph,
  GREEN_TIME,
  LANE_OFFSET,
  pedWeight,
  roadCoord,
  STOP_INSET,
  TrafficLights,
} from '../src/game/network/cityNetwork';

describe('road graph', () => {
  const g = buildRoadGraph();

  it('has 4 stop-point nodes per intersection (324), all with options', () => {
    expect(g.nodes.length).toBe(9 * 9 * 4);
    for (const n of g.nodes) expect(n.out.length).toBeGreaterThan(0);
  });

  it('never allows U-turns (same-axis edges keep their direction)', () => {
    for (const n of g.nodes) {
      for (const eid of n.out) {
        const e = g.edges[eid];
        const end = g.nodes[e.endNode];
        if (e.axis === n.axis) expect(end.dir).toBe(n.dir);
        else expect(end.axis).not.toBe(n.axis);
      }
    }
  });

  it('routes straight lines along the correct lane centre', () => {
    const n = g.nodes.find((nd) => nd.kx === 4 && nd.kz === 0 && nd.axis === 0 && nd.dir === 1)!;
    const straight = g.edges[n.out[0]];
    expect(straight.axis).toBe(0);
    expect(straight.points[0].x).toBeCloseTo(roadCoord(4) - LANE_OFFSET);
    const last = straight.points[straight.points.length - 1];
    expect(last.x).toBeCloseTo(roadCoord(4) - LANE_OFFSET);
    expect(last.z).toBeCloseTo(roadCoord(1) - STOP_INSET);
  });

  it('marks edges ending at interior intersections as signalized', () => {
    const n = g.nodes.find((nd) => nd.kx === 4 && nd.kz === 0 && nd.axis === 0 && nd.dir === 1)!;
    const straight = g.edges[n.out[0]];
    expect(straight.signalized).toBe(true);
    // boundary runs are never signalized
    const west = g.nodes.find((nd) => nd.kx === 0 && nd.kz === 0 && nd.axis === 0 && nd.dir === 1)!;
    expect(g.edges[west.out[0]].signalized).toBe(false);
  });

  it('builds turn paths with corner waypoints and valid endpoints', () => {
    let turns = 0;
    for (const e of g.edges) {
      expect(e.length).toBeGreaterThan(1);
      expect(g.nodes[e.endNode]).toBeDefined();
      if (e.points.length === 3) turns++;
    }
    expect(turns).toBeGreaterThan(100);
  });
});

describe('traffic lights', () => {
  it('alternates NS/EW phases and treats yellow as stop', () => {
    const l = new TrafficLights();
    const ns = l.allows(0, 4, 4);
    const ew = l.allows(1, 4, 4);
    expect(ns).toBe(!ew);
    for (let i = 0; i < 100; i++) l.update(GREEN_TIME / 100);
    expect(l.allows(0, 4, 4)).toBe(false);
    expect(l.allows(1, 4, 4)).toBe(false);
    l.update(2.5); // crosses the cycle boundary → phase flips
    expect(l.allows(0, 4, 4)).toBe(false);
    expect(l.allows(1, 4, 4)).toBe(true);
  });

  it('leaves boundary intersections unsignalized', () => {
    const l = new TrafficLights();
    for (let i = 0; i < 200; i++) {
      l.update(0.1);
      expect(l.allows(0, 0, 0)).toBe(true);
      expect(l.allows(1, 8, 4)).toBe(true);
    }
  });
});

describe('pedestrian network', () => {
  const net = buildPedNetwork();

  it('has 4 corner nodes per block (256), linked into loops', () => {
    expect(net.nodes.length).toBe(64 * 4);
    for (const n of net.nodes) expect(n.links.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps sidewalk nodes inside the city bounds', () => {
    for (const n of net.nodes) {
      expect(Math.abs(n.x)).toBeLessThanOrEqual(320);
      expect(Math.abs(n.z)).toBeLessThanOrEqual(320);
    }
  });

  it('flags crosswalk nodes near intersections with long links across roads', () => {
    const crossings = net.nodes.filter((n) => n.crossing);
    expect(crossings.length).toBeGreaterThan(50);
    for (const n of crossings) {
      const hasLongLink = n.links.some((id) => {
        const o = net.nodes[id];
        return Math.hypot(o.x - n.x, o.z - n.z) > 15;
      });
      expect(hasLongLink).toBe(true);
    }
  });

  it('weights pedestrian density by district', () => {
    expect(pedWeight('downtown')).toBe(3);
    expect(pedWeight('nightlife')).toBe(3);
    expect(pedWeight('beachfront')).toBe(2);
    expect(pedWeight('industrial')).toBe(0.5);
    expect(pedWeight('residential')).toBe(1);
  });
});
