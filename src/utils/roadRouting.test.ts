import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { routeRoad, buildingRadius, sideClearance } from './roadRouting';
import { getEffectiveDimensions } from './buildingDimensions';
import { Location } from '../types/city';

const at = (id: string, x: number, z: number, over: Partial<Location> = {}): Location => ({
  id,
  name: id,
  type: 'Building',
  position: [x, 0, z],
  description: '',
  zone: 'commercial',
  ...over
});

/** Shortest distance from a building centre to a polyline, in the ground plane. */
function clearanceOf(path: THREE.Vector3[], building: Location): number {
  const c = new THREE.Vector2(building.position[0], building.position[2]);
  let best = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const a = new THREE.Vector2(path[i].x, path[i].z);
    const b = new THREE.Vector2(path[i + 1].x, path[i + 1].z);
    const ab = new THREE.Vector2().subVectors(b, a);
    const lenSq = ab.lengthSq();
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
      new THREE.Vector2().subVectors(c, a).dot(ab) / lenSq));
    const closest = new THREE.Vector2().addVectors(a, ab.clone().multiplyScalar(t));
    best = Math.min(best, c.distanceTo(closest));
  }
  return best;
}

describe('buildingRadius', () => {
  it('encloses the footprint', () => {
    const b = at('b', 0, 0);
    const { width, depth } = getEffectiveDimensions(b);
    const r = buildingRadius(b);
    expect(r).toBeGreaterThanOrEqual(width / 2);
    expect(r).toBeGreaterThanOrEqual(depth / 2);
  });

  it('grows when the building is resized', () => {
    const small = at('b', 0, 0, { design: { width: 10, depth: 10 } });
    const large = at('b', 0, 0, { design: { width: 70, depth: 70 } });
    expect(buildingRadius(large)).toBeGreaterThan(buildingRadius(small));
  });
});

describe('routeRoad endpoints', () => {
  const a = at('a', 0, 0);
  const b = at('b', 300, 0);

  it('starts outside the origin building, not at its centre', () => {
    // The whole bug: the road used to begin at the centre, so its first
    // half-footprint was inside the building.
    const path = routeRoad(a, b, 'main', { obstacles: [a, b] });
    const startDistance = new THREE.Vector2(path[0].x, path[0].z)
      .distanceTo(new THREE.Vector2(0, 0));
    expect(startDistance).toBeGreaterThanOrEqual(buildingRadius(a));
  });

  it('ends outside the destination building', () => {
    const path = routeRoad(a, b, 'main', { obstacles: [a, b] });
    const last = path[path.length - 1];
    const endDistance = new THREE.Vector2(last.x, last.z)
      .distanceTo(new THREE.Vector2(300, 0));
    expect(endDistance).toBeGreaterThanOrEqual(buildingRadius(b));
  });

  it('stays on the axis when nothing is in the way', () => {
    const path = routeRoad(a, b, 'main', { obstacles: [a, b] });
    expect(path).toHaveLength(2);
    for (const p of path) expect(Math.abs(p.z)).toBeLessThan(1e-6);
  });

  it('is shorter than the centre-to-centre distance', () => {
    const path = routeRoad(a, b, 'main', { obstacles: [a, b] });
    const length = new THREE.Vector2(path[0].x, path[0].z)
      .distanceTo(new THREE.Vector2(path[1].x, path[1].z));
    expect(length).toBeLessThan(300);
  });

  it('returns a short stub instead of an inverted segment for adjacent buildings', () => {
    const near = at('near', 20, 0);
    const path = routeRoad(a, near, 'main', { obstacles: [a, near] });
    expect(path.length).toBeGreaterThanOrEqual(2);

    const length = new THREE.Vector2(path[0].x, path[0].z)
      .distanceTo(new THREE.Vector2(path[path.length - 1].x, path[path.length - 1].z));
    expect(length).toBeGreaterThan(0);
    // Direction must still run from a towards near, not backwards.
    expect(path[path.length - 1].x).toBeGreaterThan(path[0].x);
  });

  it('handles two buildings at the same spot without throwing', () => {
    const dup = at('dup', 0, 0);
    expect(() => routeRoad(a, dup, 'main', { obstacles: [a, dup] })).not.toThrow();
  });
});

describe('routeRoad obstacle avoidance', () => {
  const a = at('a', -200, 0);
  const b = at('b', 200, 0);

  it('bends around a building sitting on the straight line', () => {
    const blocker = at('blocker', 0, 0);
    const path = routeRoad(a, b, 'main', { obstacles: [a, b, blocker] });

    expect(path.length).toBeGreaterThan(2);
    expect(clearanceOf(path, blocker)).toBeGreaterThanOrEqual(
      sideClearance(blocker, 'main') - 0.01
    );
  });

  it('returns a densely sampled curve when it has to deflect', () => {
    // The path must stay dense: splining a sparse bend list would cut the
    // corner straight back through the building it routed around.
    const blocker = at('blocker', 0, 0);
    const path = routeRoad(a, b, 'main', { obstacles: [a, b, blocker] });
    expect(path.length).toBeGreaterThan(8);
  });

  it('deflects away from the blocker, not towards it', () => {
    // Blocker sits slightly north of the axis, so the road should go south.
    const blocker = at('blocker', 0, 6);
    const path = routeRoad(a, b, 'main', { obstacles: [a, b, blocker] });

    // Sample nearest the blocker, rather than assuming which index bends.
    const nearest = path.reduce((best, p) =>
      Math.abs(p.x) < Math.abs(best.x) ? p : best);
    expect(nearest.z).toBeLessThan(0);
  });

  it('clears a larger building by a wider margin', () => {
    const small = at('small', 0, 0, { design: { width: 12, depth: 12 } });
    const large = at('large', 0, 0, { design: { width: 70, depth: 70 } });

    const nearSmall = clearanceOf(
      routeRoad(a, b, 'main', { obstacles: [a, b, small] }), small);
    const nearLarge = clearanceOf(
      routeRoad(a, b, 'main', { obstacles: [a, b, large] }), large);

    expect(nearLarge).toBeGreaterThan(nearSmall);
  });

  it('gives a wider berth on a wider road class', () => {
    const blocker = at('blocker', 0, 0);
    const local = clearanceOf(
      routeRoad(a, b, 'residential', { obstacles: [a, b, blocker] }), blocker);
    const main = clearanceOf(
      routeRoad(a, b, 'main', { obstacles: [a, b, blocker] }), blocker);
    expect(main).toBeGreaterThan(local);
  });

  it('clears several blockers at once', () => {
    const blockers = [at('b1', -60, 4), at('b2', 0, 0), at('b3', 70, -3)];
    const path = routeRoad(a, b, 'secondary', { obstacles: [a, b, ...blockers] });

    for (const blocker of blockers) {
      expect(
        clearanceOf(path, blocker),
        `${blocker.id} clearance`
      ).toBeGreaterThanOrEqual(buildingRadius(blocker));
    }
  });

  it('ignores buildings that are nowhere near the road', () => {
    const distant = at('distant', 0, 900);
    const path = routeRoad(a, b, 'main', { obstacles: [a, b, distant] });
    expect(path).toHaveLength(2);
  });

  it('never treats its own endpoints as obstacles', () => {
    // a and b are in the obstacle list; if they were honoured the route would
    // be pushed sideways off its own axis.
    const path = routeRoad(a, b, 'main', { obstacles: [a, b] });
    expect(path).toHaveLength(2);
  });
});

describe('routed path shape', () => {
  const a = at('a', -200, 0);
  const b = at('b', 200, 0);

  it('stays flat on the ground plane', () => {
    const path = routeRoad(a, b, 'main', { obstacles: [a, b, at('x', 0, 0)] });
    for (const p of path) expect(Math.abs(p.y)).toBeLessThan(1e-6);
  });

  it('returns to the axis at both ends so it meets the buildings', () => {
    const path = routeRoad(a, b, 'main', { obstacles: [a, b, at('x', 0, 0)] });
    expect(Math.abs(path[0].z)).toBeLessThan(1e-6);
    expect(Math.abs(path[path.length - 1].z)).toBeLessThan(1e-6);
  });

  it('progresses monotonically from start to end', () => {
    const path = routeRoad(a, b, 'main', { obstacles: [a, b, at('x', 0, 0)] });
    for (let i = 1; i < path.length; i++) {
      expect(path[i].x).toBeGreaterThan(path[i - 1].x);
    }
  });

  it('is deterministic', () => {
    const obstacles = [a, b, at('x', 0, 0), at('y', 80, -5)];
    const first = routeRoad(a, b, 'main', { obstacles });
    const second = routeRoad(a, b, 'main', { obstacles });
    expect(first.map(p => [p.x, p.z])).toEqual(second.map(p => [p.x, p.z]));
  });
});

describe('real template data', () => {
  it('routes every shipped road clear of every building', async () => {
    // The synthetic cases above prove the algorithm; this proves the content.
    // Every road in the city-planning template is routed and checked against
    // every building that is not one of its own endpoints.
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const { corporateCampusData } = await import('../data/corporateCampusData');

    for (const template of [cityPlanningData, corporateCampusData]) {
      const byId = new Map(template.locations.map(l => [l.id, l]));

      for (const road of template.roads) {
        const from = byId.get(road.from);
        const to = byId.get(road.to);
        if (!from || !to) continue;

        const path = routeRoad(from, to, road.type, { obstacles: template.locations });
        if (path.length < 2) continue;

        for (const building of template.locations) {
          if (building.id === from.id || building.id === to.id) continue;

          // The road surface must not overlap the building footprint. Compared
          // against buildingRadius (the footprint itself) rather than the
          // padded sideClearance, which also includes pavement margin.
          expect(
            clearanceOf(path, building),
            `road ${road.id} (${from.name} -> ${to.name}) vs ${building.name}`
          ).toBeGreaterThanOrEqual(buildingRadius(building));
        }
      }
    }
  });

  it('starts and ends every shipped road outside its own buildings', async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const byId = new Map(cityPlanningData.locations.map(l => [l.id, l]));

    for (const road of cityPlanningData.roads) {
      const from = byId.get(road.from);
      const to = byId.get(road.to);
      if (!from || !to) continue;

      const path = routeRoad(from, to, road.type, { obstacles: cityPlanningData.locations });
      const head = new THREE.Vector2(path[0].x, path[0].z);
      const tail = new THREE.Vector2(path[path.length - 1].x, path[path.length - 1].z);

      expect(
        head.distanceTo(new THREE.Vector2(from.position[0], from.position[2])),
        `road ${road.id} start inside ${from.name}`
      ).toBeGreaterThanOrEqual(buildingRadius(from) - 0.01);

      expect(
        tail.distanceTo(new THREE.Vector2(to.position[0], to.position[2])),
        `road ${road.id} end inside ${to.name}`
      ).toBeGreaterThanOrEqual(buildingRadius(to) - 0.01);
    }
  });
});
