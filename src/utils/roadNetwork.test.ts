import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildRoadNetwork, drivingCurve, roadKeepOuts, maxBuildableSize
} from './roadNetwork';
import {
  elevatePath, BRIDGE_CLEARANCE, crossingKey, CrossingStyle, roundaboutRadii,
  fitRoundabout, ROUNDABOUT_BUILDING_GAP
} from './roadCrossings';
import {
  distanceToNearestBuilding, maxDimensionsFor, footprintOf, footprintsIntersect
} from './buildingCollision';
import { DESIGN_LIMITS, getEffectiveDimensions } from './buildingDimensions';
import { buildingRadius } from './roadRouting';
import { ROAD_SURFACE_Y, CAR, PAVEMENT_WIDTH } from './scale';
import { elevationAt } from './terrain';
import { Location, Road } from '../types/city';

const at = (id: string, x: number, z: number, over: Partial<Location> = {}): Location => ({
  id,
  name: id,
  type: 'Building',
  position: [x, 0, z],
  description: '',
  zone: 'commercial',
  ...over
});

const link = (id: string, from: string, to: string, type: Road['type'] = 'secondary'): Road => ({
  id, from, to, distance: 100, type
});

/** Shortest ground-plane distance from a building centre to a path. */
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

/** A crossing where road 'a' bridges over another, for elevatePath tests. */
function crossingFixture(point: THREE.Vector2, other = 'b') {
  return {
    key: `a~${other}`,
    primaryId: 'a',
    secondaryId: other,
    style: 'bridge' as const,
    overId: 'a',
    underId: other,
    point,
    deckY: ROAD_SURFACE_Y + BRIDGE_CLEARANCE,
    width: 9,
    junctionWidth: 9,
    roundaboutOuter: 13.5,
    roundaboutFits: true
  };
}

describe('buildRoadNetwork', () => {
  const locations = [at('a', -200, 0), at('b', 200, 0), at('c', 0, -200), at('d', 0, 200)];
  const roads = [link('r1', 'a', 'b', 'main'), link('r2', 'c', 'd', 'residential')];

  it('produces one entry per resolvable road', () => {
    expect(buildRoadNetwork(locations, roads, {}).roads).toHaveLength(2);
  });

  it('skips roads whose endpoints are missing', () => {
    const network = buildRoadNetwork(locations, [...roads, link('ghost', 'a', 'nope')], {});
    expect(network.roads).toHaveLength(2);
  });

  it('gives the vehicle curve and the road ribbon the same points', () => {
    // The two used to be computed independently and drifted apart, leaving
    // vehicles driving beside their own roads.
    const network = buildRoadNetwork(locations, roads, {});
    const entry = network.roads[0];
    const curve = drivingCurve(entry);
    expect(curve.points).toEqual(entry.path);
  });

  it('is deterministic', () => {
    const a = buildRoadNetwork(locations, roads, {});
    const b = buildRoadNetwork(locations, roads, {});
    expect(a.roads.map(r => r.path.map(p => [p.x, p.y, p.z])))
      .toEqual(b.roads.map(r => r.path.map(p => [p.x, p.y, p.z])));
  });
});

describe('vehicles stay out of buildings', () => {
  it('keeps the driving line clear of every unrelated footprint', () => {
    const blocker = at('mid', 0, 0);
    const locations = [at('a', -250, 0), at('b', 250, 0), blocker];
    const network = buildRoadNetwork(locations, [link('r', 'a', 'b', 'main')], {});

    const path = network.roads[0].path;
    // Half a car's width beyond the centre-line still has to clear the building.
    expect(clearanceOf(path, blocker)).toBeGreaterThan(buildingRadius(blocker) + CAR.width / 2);
  });

  it('holds for the shipped templates', async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const network = buildRoadNetwork(cityPlanningData.locations, cityPlanningData.roads, {});
    const byId = new Map(cityPlanningData.locations.map(l => [l.id, l]));

    for (const entry of network.roads) {
      for (const building of cityPlanningData.locations) {
        if (building.id === entry.fromId || building.id === entry.toId) continue;
        expect(
          clearanceOf(entry.path, building),
          `${entry.road.id} vs ${building.name}`
        ).toBeGreaterThanOrEqual(buildingRadius(building));
      }
      expect(byId.has(entry.fromId)).toBe(true);
    }
  });
});

describe('findCrossings', () => {
  const crossing = (styles: Record<string, CrossingStyle> = {}) => {
    const locations = [at('a', -200, 0), at('b', 200, 0), at('c', 0, -200), at('d', 0, 200)];
    const roads = [link('r1', 'a', 'b', 'main'), link('r2', 'c', 'd', 'residential')];
    return buildRoadNetwork(locations, roads, styles);
  };

  it('finds two roads that cross mid-span', () => {
    expect(crossing().crossings).toHaveLength(1);
  });

  it('defaults to an at-grade crossing with neither road raised', () => {
    // Grade separation is now an explicit choice, not something that happens
    // automatically the moment two roads happen to cross.
    const { crossings } = crossing();
    expect(crossings[0].style).toBe('signals');
    expect(crossings[0].overId).toBeNull();
    expect(crossings[0].underId).toBeNull();
  });

  it('picks a stable primary road so "bridge" always means the same thing', () => {
    const { crossings } = crossing();
    // Lower id wins, regardless of the order the pair was examined in.
    expect(crossings[0].primaryId).toBe('r1');
    expect(crossings[0].secondaryId).toBe('r2');
  });

  it('raises the primary road when set to bridge', () => {
    const { crossings } = crossing({ [crossingKey('r1', 'r2')]: 'bridge' });
    expect(crossings[0].overId).toBe('r1');
    expect(crossings[0].underId).toBe('r2');
  });

  it('raises the other road when set to underpass', () => {
    const { crossings } = crossing({ [crossingKey('r1', 'r2')]: 'underpass' });
    expect(crossings[0].overId).toBe('r2');
    expect(crossings[0].underId).toBe('r1');
  });

  it('keeps both roads at grade for a roundabout', () => {
    const { crossings } = crossing({ [crossingKey('r1', 'r2')]: 'roundabout' });
    expect(crossings[0].overId).toBeNull();
    expect(crossings[0].underId).toBeNull();
  });

  describe('roundabout circulation', () => {
    const network = () => crossing({ [crossingKey('r1', 'r2')]: 'roundabout' });

    /** Closest the driving line gets to the roundabout centre. */
    const closestApproach = (net: ReturnType<typeof crossing>, roadId: string) => {
      const entry = net.roads.find(r => r.road.id === roadId)!;
      const c = net.crossings[0].point;
      const curve = drivingCurve(entry);
      let best = Infinity;
      for (let t = 0; t <= 1; t += 0.005) {
        const p = curve.getPointAt(t);
        best = Math.min(best, Math.hypot(p.x - c.x, p.z - c.y));
      }
      return best;
    };

    it('keeps both roads clear of the central island', () => {
      // Straight through the middle means driving over the island.
      const net = network();
      const { island } = roundaboutRadii(net.crossings[0]);

      for (const roadId of ['r1', 'r2']) {
        expect(closestApproach(net, roadId), `${roadId} over the island`)
          .toBeGreaterThanOrEqual(island * 0.9);
      }
    });

    it('follows the circulating carriageway rather than clipping the kerb', () => {
      const net = network();
      const { lane, outer } = roundaboutRadii(net.crossings[0]);
      const approach = closestApproach(net, 'r1');

      // Sits on the circulating lane, inside the outer edge.
      expect(approach).toBeGreaterThan(lane * 0.75);
      expect(approach).toBeLessThan(outer);
    });

    it('makes the route longer than the straight line it replaced', () => {
      const straight = crossing();
      const round = network();
      const length = (net: ReturnType<typeof crossing>, id: string) => {
        const p = net.roads.find(r => r.road.id === id)!.path;
        let total = 0;
        for (let i = 1; i < p.length; i++) total += p[i].distanceTo(p[i - 1]);
        return total;
      };
      expect(length(round, 'r1')).toBeGreaterThan(length(straight, 'r1'));
    });

    it('still starts and ends at the same buildings', () => {
      const straight = crossing();
      const round = network();
      const ends = (net: ReturnType<typeof crossing>, id: string) => {
        const p = net.roads.find(r => r.road.id === id)!.path;
        return [p[0], p[p.length - 1]];
      };
      const [s0, s1] = ends(straight, 'r1');
      const [r0, r1] = ends(round, 'r1');

      expect(r0.x).toBeCloseTo(s0.x, 4);
      expect(r0.z).toBeCloseTo(s0.z, 4);
      expect(r1.x).toBeCloseTo(s1.x, 4);
      expect(r1.z).toBeCloseTo(s1.z, 4);
    });

    it('stays on the ground — a roundabout is an at-grade junction', () => {
      // "Flat" means following the terrain, not sitting at a fixed height:
      // roads take their level from the ground they are built on.
      const net = network();
      for (const entry of net.roads) {
        for (const p of entry.path) {
          expect(p.y).toBeCloseTo(elevationAt(p.x, p.z) + ROAD_SURFACE_Y, 5);
        }
      }
    });

    it('circulates even when a road begins inside the junction', () => {
      /*
        A roundabout can land close to the building a road terminates at, so the
        road's first point is already inside the circulating area. That case was
        skipped, leaving one road driving over the island while the other went
        round it correctly.
      */
      const locations = [
        at('a', -30, 0), at('b', 300, 0),      // 'a' sits right by the crossing
        at('c', 0, -220), at('d', 0, 220)
      ];
      const roads = [link('r1', 'a', 'b', 'main'), link('r2', 'c', 'd', 'secondary')];
      const net = buildRoadNetwork(locations, roads, {
        [crossingKey('r1', 'r2')]: 'roundabout'
      });

      expect(net.crossings).toHaveLength(1);
      const { island } = roundaboutRadii(net.crossings[0]);
      const c = net.crossings[0].point;

      for (const id of ['r1', 'r2']) {
        const curve = drivingCurve(net.roads.find(r => r.road.id === id)!);
        let closest = Infinity;
        for (let t = 0; t <= 1; t += 0.005) {
          const p = curve.getPointAt(t);
          closest = Math.min(closest, Math.hypot(p.x - c.x, p.z - c.y));
        }
        expect(closest, `${id} crosses the island`).toBeGreaterThanOrEqual(island * 0.85);
      }
    });

    it('shrinks to fit rather than overrunning a nearby building', () => {
      /*
        Main road gives a 14 m junction width, so the natural radius is 21 m.
        A 20 m-wide building centred at x=28 puts its near edge at x=18, leaving
        18 - 3 = 15 m of usable radius: tight enough to shrink, wide enough to
        stay above the 14 m minimum.
      */
      const near = at('near', 28, 0, { design: { width: 20, depth: 20 } });
      const locations = [
        at('a', -200, 0), at('b', 200, 0),
        at('c', 0, -200), at('d', 0, 200),
        near
      ];
      const net = buildRoadNetwork(
        locations,
        [link('r1', 'a', 'b', 'main'), link('r2', 'c', 'd', 'secondary')],
        { [crossingKey('r1', 'r2')]: 'roundabout' }
      );

      const crossing = net.crossings[0];
      const { outer } = roundaboutRadii(crossing);
      const clearance = distanceToNearestBuilding(crossing.point.x, crossing.point.y, locations);

      expect(crossing.style).toBe('roundabout');
      expect(outer).toBeLessThan(crossing.junctionWidth * 1.5); // shrunk
      expect(outer + ROUNDABOUT_BUILDING_GAP).toBeLessThanOrEqual(clearance + 0.001);
    });

    it('refuses a roundabout with no room and falls back to signals', () => {
      // Building right on top of the crossing.
      const locations = [
        at('a', -200, 0), at('b', 200, 0),
        at('c', 0, -200), at('d', 0, 200),
        at('blocker', 8, 8, { design: { width: 20, depth: 20 } })
      ];
      const net = buildRoadNetwork(
        locations,
        [link('r1', 'a', 'b', 'main'), link('r2', 'c', 'd', 'secondary')],
        { [crossingKey('r1', 'r2')]: 'roundabout' }
      );

      const crossing = net.crossings[0];
      expect(crossing.roundaboutFits).toBe(false);
      // The requested style is not applied; signals are used instead.
      expect(crossing.style).toBe('signals');
    });

    it('never draws an island inside a building footprint', () => {
      // Sweep a building across a range of distances from the crossing.
      for (let d = 6; d <= 60; d += 2) {
        const locations = [
          at('a', -200, 0), at('b', 200, 0),
          at('c', 0, -200), at('d', 0, 200),
          at('near', d, 0, { design: { width: 20, depth: 20 } })
        ];
        const net = buildRoadNetwork(
          locations,
          [link('r1', 'a', 'b', 'main'), link('r2', 'c', 'd', 'secondary')],
          { [crossingKey('r1', 'r2')]: 'roundabout' }
        );
        const crossing = net.crossings[0];
        if (crossing.style !== 'roundabout') continue; // refused, nothing drawn

        const { outer } = roundaboutRadii(crossing);
        const clearance = distanceToNearestBuilding(
          crossing.point.x, crossing.point.y, locations
        );
        expect(outer, `overlap at building distance ${d}`)
          .toBeLessThanOrEqual(clearance - ROUNDABOUT_BUILDING_GAP + 0.001);
      }
    });

    it('keeps the natural size when nothing is nearby', () => {
      const net = network();
      expect(roundaboutRadii(net.crossings[0]).outer)
        .toBeCloseTo(net.crossings[0].junctionWidth * 1.5, 5);
    });

    describe('fitRoundabout', () => {
      const width = 14; // a main road

      it('uses the natural radius with room to spare', () => {
        const fit = fitRoundabout(width, 500);
        expect(fit.fits).toBe(true);
        expect(fit.outer).toBe(width * 1.5);
      });

      it('shrinks to the space available', () => {
        const fit = fitRoundabout(width, 20);
        expect(fit.fits).toBe(true);
        expect(fit.outer).toBe(20 - ROUNDABOUT_BUILDING_GAP);
      });

      it('refuses once below the minimum usable size', () => {
        // Anything under width * 1.0 leaves no circulating lane for a bus.
        expect(fitRoundabout(width, width).fits).toBe(false);
        expect(fitRoundabout(width, 0).fits).toBe(false);
      });

      it('never returns a radius that breaches the gap', () => {
        for (let clearance = 0; clearance <= 60; clearance += 1) {
          const fit = fitRoundabout(width, clearance);
          if (!fit.fits) continue;
          expect(fit.outer + ROUNDABOUT_BUILDING_GAP)
            .toBeLessThanOrEqual(clearance + 1e-9);
        }
      });

      it('scales the minimum with the roads meeting there', () => {
        // A wider junction needs more room before it can be built at all.
        const narrow = fitRoundabout(6, 12);
        const wide = fitRoundabout(14, 12);
        expect(narrow.fits).toBe(true);
        expect(wide.fits).toBe(false);
      });
    });

    it('leaves roads alone at a signalised crossing', () => {
      const signals = crossing();
      const { island } = roundaboutRadii(signals.crossings[0]);
      // No deformation, so the straight road passes right by the centre.
      expect(closestApproach(signals, 'r1')).toBeLessThan(island);
    });
  });

  it('only lifts the road that goes over', () => {
    const network = crossing({ [crossingKey('r1', 'r2')]: 'bridge' });
    const over = network.roads.find(r => r.road.id === 'r1')!;
    const under = network.roads.find(r => r.road.id === 'r2')!;

    const aboveGround = (path: typeof over.path) =>
      Math.max(...path.map(p => p.y - elevationAt(p.x, p.z) - ROAD_SURFACE_Y));

    expect(aboveGround(over.path)).toBeGreaterThan(1);
    expect(aboveGround(under.path)).toBeCloseTo(0, 5);
  });

  it('gives the same crossing key regardless of road order', () => {
    expect(crossingKey('r2', 'r1')).toBe(crossingKey('r1', 'r2'));
  });

  it('carries the deck height into the driving line, not just the ribbon', () => {
    /*
      Cars drove *under* a raised bridge because the vehicle layer rebuilt the
      network without the crossing styles: the ribbon was lifted, the driving
      curve was not. Sampling the curve is what a vehicle actually does.
    */
    const network = crossing({ [crossingKey('r1', 'r2')]: 'bridge' });
    const over = network.roads.find(r => r.road.id === 'r1')!;
    const curve = drivingCurve(over);

    let peak = -Infinity;
    for (let t = 0; t <= 1; t += 0.02) {
      peak = Math.max(peak, curve.getPointAt(t).y);
    }
    expect(peak).toBeGreaterThan(ROAD_SURFACE_Y + BRIDGE_CLEARANCE * 0.8);
  });

  it('leaves the driving line on the ground for the road passing beneath', () => {
    const network = crossing({ [crossingKey('r1', 'r2')]: 'bridge' });
    const under = network.roads.find(r => r.road.id === 'r2')!;
    const curve = drivingCurve(under);

    for (let t = 0; t <= 1; t += 0.05) {
      const p = curve.getPointAt(t);
      // The curve interpolates between ground-following vertices, so it tracks
      // the terrain closely rather than exactly.
      expect(Math.abs(p.y - elevationAt(p.x, p.z) - ROAD_SURFACE_Y)).toBeLessThan(0.5);
    }
  });

  it('clears the deck above the road underneath by the stated headroom', () => {
    const network = crossing({ [crossingKey('r1', 'r2')]: 'bridge' });
    const over = network.roads.find(r => r.road.id === 'r1')!;
    const point = network.crossings[0].point;

    // Headroom is the gap over the road underneath, not the height above sea
    // level — on sloping ground those are different numbers.
    const above = over.path.reduce((best, p) =>
      Math.hypot(p.x - point.x, p.z - point.y) < Math.hypot(best.x - point.x, best.z - point.y)
        ? p : best);
    const roadBelow = elevationAt(point.x, point.y) + ROAD_SURFACE_Y;

    expect(above.y - roadBelow).toBeGreaterThanOrEqual(BRIDGE_CLEARANCE * 0.9);
  });

  it('ignores roads that merely meet at a shared building', () => {
    const locations = [at('hub', 0, 0), at('a', 200, 0), at('b', 0, 200)];
    const roads = [link('r1', 'hub', 'a'), link('r2', 'hub', 'b')];
    expect(buildRoadNetwork(locations, roads, {}).crossings).toHaveLength(0);
  });

  it('finds nothing when roads run parallel', () => {
    const locations = [at('a', -200, 0), at('b', 200, 0), at('c', -200, 120), at('d', 200, 120)];
    const roads = [link('r1', 'a', 'b'), link('r2', 'c', 'd')];
    expect(buildRoadNetwork(locations, roads, {}).crossings).toHaveLength(0);
  });

  it('is stable across runs rather than alternating which road bridges', () => {
    const first = crossing().crossings[0];
    const second = crossing().crossings[0];
    expect(first.overId).toBe(second.overId);
  });
});

describe('elevatePath', () => {
  const straight = Array.from({ length: 30 }, (_, i) =>
    new THREE.Vector3(-200 + (i / 29) * 400, ROAD_SURFACE_Y, 0));

  it('leaves a road with no crossings flat', () => {
    const out = elevatePath(straight, []);
    expect(out).toBe(straight);
  });

  it('raises the deck to the clearance height over the crossing', () => {
    const out = elevatePath(straight, [{
      ...crossingFixture(new THREE.Vector2(0, 0))
    }]);

    const peak = Math.max(...out.map(p => p.y));
    expect(peak).toBeGreaterThan(ROAD_SURFACE_Y + BRIDGE_CLEARANCE * 0.9);
  });

  it('returns to grade at both ends', () => {
    const out = elevatePath(straight, [{
      ...crossingFixture(new THREE.Vector2(0, 0))
    }]);

    expect(out[0].y).toBeCloseTo(ROAD_SURFACE_Y, 5);
    expect(out[out.length - 1].y).toBeCloseTo(ROAD_SURFACE_Y, 5);
  });

  it('never dips below grade', () => {
    const out = elevatePath(straight, [{
      ...crossingFixture(new THREE.Vector2(40, 0))
    }]);
    for (const p of out) expect(p.y).toBeGreaterThanOrEqual(ROAD_SURFACE_Y);
  });

  it('leaves the ground plan untouched — only height changes', () => {
    const out = elevatePath(straight, [{
      ...crossingFixture(new THREE.Vector2(0, 0))
    }]);
    out.forEach((p, i) => {
      expect(p.x).toBeCloseTo(straight[i].x, 6);
      expect(p.z).toBeCloseTo(straight[i].z, 6);
    });
  });

  it('stays up between two crossings close together', () => {
    const out = elevatePath(straight, [
      { ...crossingFixture(new THREE.Vector2(-20, 0)) },
      { ...crossingFixture(new THREE.Vector2(20, 0), 'c') }
    ]);

    // The midpoint between them must not sag back to the road surface.
    const middle = out.find(p => Math.abs(p.x) < 8)!;
    expect(middle.y).toBeGreaterThan(ROAD_SURFACE_Y + BRIDGE_CLEARANCE * 0.5);
  });

  it('gives enough headroom for the road passing beneath', () => {
    expect(BRIDGE_CLEARANCE).toBeGreaterThan(4.5);
  });
});

describe('roadKeepOuts', () => {
  /*
    A through-road that misses the building being sized: c -> d runs north-south
    at x = 40, well clear of `a` at the origin.
  */
  const throughRoad = () => {
    const a = at('a', 0, 0);
    const c = at('c', 40, -120);
    const d = at('d', 40, 120);
    return {
      a,
      locations: [a, c, d],
      roads: [link('cd', 'c', 'd')]
    };
  };

  it('covers the corridor with no gaps a footprint could slip through', () => {
    const { locations, roads } = throughRoad();
    const network = buildRoadNetwork(locations, roads, {});
    const boxes = roadKeepOuts(network);

    expect(boxes.length).toBeGreaterThan(0);

    // Consecutive samples must overlap, or a building could sit between them.
    const sorted = [...boxes].sort((p, q) => p.z - q.z);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].z - sorted[i - 1].z)
        .toBeLessThanOrEqual(sorted[i].radius * 2);
    }
  });

  it('stops a building growing across a road', () => {
    const { a, locations, roads } = throughRoad();
    const network = buildRoadNetwork(locations, roads, {});

    const open = maxDimensionsFor(a, [a]);
    const withRoad = maxDimensionsFor(a, [a], roadKeepOuts(network, a.id));

    expect(open.width).toBe(DESIGN_LIMITS.width.max);
    expect(withRoad.width).toBeLessThan(open.width);
    // Wall must stop short of the kerb at x = 33.
    expect(withRoad.width / 2).toBeLessThanOrEqual(40 - 7);
  });

  it('exempts a road that terminates at the building itself', () => {
    // The access road runs to a's centre, so without the exemption `a` would be
    // crushed to the minimum by its own driveway.
    const a = at('a', 0, 0);
    const b = at('b', 200, 0);
    const network = buildRoadNetwork([a, b], [link('ab', 'a', 'b')], {});

    expect(roadKeepOuts(network, a.id)).toHaveLength(0);
    expect(roadKeepOuts(network).length).toBeGreaterThan(0);
    expect(maxDimensionsFor(a, [a], roadKeepOuts(network, a.id)).width)
      .toBe(DESIGN_LIMITS.width.max);
  });

  it('keeps buildings out of a roundabout', () => {
    const locations = [
      at('n', 0, -150), at('s', 0, 150), at('e', 150, 0), at('w', -150, 0)
    ];
    const roads = [link('ns', 'n', 's'), link('ew', 'e', 'w')];

    const flat = buildRoadNetwork(locations, roads, {});
    const crossing = flat.crossings[0];
    expect(crossing).toBeDefined();

    const circle = buildRoadNetwork(locations, roads, {
      [crossing.key]: 'roundabout' as CrossingStyle
    });
    const island = circle.crossings.find(c => c.style === 'roundabout')!;
    const { outer } = roundaboutRadii(island);

    const boxes = roadKeepOuts(circle);
    const match = boxes.find(b => b.radius > outer);
    expect(match).toBeDefined();
    expect(match!.x).toBeCloseTo(island.point.x, 6);
    expect(match!.z).toBeCloseTo(island.point.y, 6);
  });

  /*
    The router bends roads clear of buildings, so whatever stands today already
    fits. A cap below the current size would pin the editor's slider under its
    own handle — which is exactly what an axis-aligned approximation of a
    diagonal road did: a 20 m building beside a 45° road capped at 11 m.
  */
  it('never caps a building below the size it already is', () => {
    for (let angle = 0; angle < 180; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      const a = at('a', 50, 30);
      const from = at('f', 50 - Math.cos(rad) * 200, 30 - Math.sin(rad) * 200);
      const to = at('t', 50 + Math.cos(rad) * 200, 30 + Math.sin(rad) * 200);

      const locations = [a, from, to];
      const network = buildRoadNetwork(locations, [link('ft', 'f', 't', 'main')], {});
      const fit = maxDimensionsFor(a, locations, roadKeepOuts(network, a.id));
      const current = getEffectiveDimensions(a);

      expect(fit.width, `width capped below current at ${angle}°`)
        .toBeGreaterThanOrEqual(current.width);
      expect(fit.depth, `depth capped below current at ${angle}°`)
        .toBeGreaterThanOrEqual(current.depth);
    }
  });

  it('adds no roundabout box at an at-grade crossing', () => {
    const locations = [
      at('n', 0, -150), at('s', 0, 150), at('e', 150, 0), at('w', -150, 0)
    ];
    const roads = [link('ns', 'n', 's'), link('ew', 'e', 'w')];
    const network = buildRoadNetwork(locations, roads, {});

    // Every circle should be a carriageway sample, never a wide island.
    expect(network.crossings.length).toBeGreaterThan(0);
    expect(roadKeepOuts(network).every(b => b.radius <= 7 + PAVEMENT_WIDTH))
      .toBe(true);
  });
});

describe('maxBuildableSize', () => {
  /*
    Police HQ's situation in the shipped template: a building tucked between two
    arterials that both bend around it. The one-step answer was ~1 m above
    whatever size it happened to be, which read as a hard-coded per-building
    limit; the real ceiling is several times that.
  */
  const wedged = () => {
    const a = at('a', 50, 30);
    const hub = at('hub', 0, 0);
    const ne = at('ne', 150, 150);
    const east = at('east', 250, 0);
    return {
      a,
      locations: [a, hub, ne, east],
      roads: [link('r1', 'hub', 'ne', 'main'), link('r2', 'hub', 'east', 'main')]
    };
  };

  it('reports far more room than the one-step answer', () => {
    const { a, locations, roads } = wedged();
    const network = buildRoadNetwork(locations, roads, {});

    const oneStep = maxDimensionsFor(a, locations, roadKeepOuts(network, a.id));
    const solved = maxBuildableSize(a, locations, roads, {});

    expect(solved.width).toBeGreaterThan(oneStep.width);
    expect(solved.width).toBeGreaterThan(getEffectiveDimensions(a).width * 1.5);
  });

  it('returns a size that survives its own re-routing', () => {
    const { a, locations, roads } = wedged();
    const solved = maxBuildableSize(a, locations, roads, {});

    for (const axis of ['width', 'depth'] as const) {
      const grown = locations.map(l => l.id === a.id
        ? { ...l, design: { ...l.design, [axis]: solved[axis] } } : l);
      const me = grown.find(l => l.id === a.id)!;
      const network = buildRoadNetwork(grown, roads, {});
      const room = maxDimensionsFor(me, grown, roadKeepOuts(network, a.id));

      expect(room[axis], `${axis} ${solved[axis]} is not self-consistent`)
        .toBeGreaterThanOrEqual(solved[axis]);
    }
  });

  it('is one metre short of illegal — the answer is actually maximal', () => {
    const { a, locations, roads } = wedged();
    const solved = maxBuildableSize(a, locations, roads, {});
    expect(solved.width).toBeLessThan(DESIGN_LIMITS.width.max);

    const over = solved.width + 1;
    const grown = locations.map(l => l.id === a.id
      ? { ...l, design: { ...l.design, width: over } } : l);
    const me = grown.find(l => l.id === a.id)!;
    const network = buildRoadNetwork(grown, roads, {});

    expect(maxDimensionsFor(me, grown, roadKeepOuts(network, a.id)).width)
      .toBeLessThan(over);
  });

  it('agrees with an exhaustive scan, so the binary search is safe here', () => {
    const { a, locations, roads } = wedged();

    const legal = (value: number) => {
      const grown = locations.map(l => l.id === a.id
        ? { ...l, design: { ...l.design, width: value } } : l);
      const me = grown.find(l => l.id === a.id)!;
      const network = buildRoadNetwork(grown, roads, {});
      return maxDimensionsFor(me, grown, roadKeepOuts(network, a.id)).width >= value;
    };

    let scanned = DESIGN_LIMITS.width.min;
    for (let v = DESIGN_LIMITS.width.min; v <= DESIGN_LIMITS.width.max; v++) {
      if (legal(v)) scanned = v;
    }

    expect(maxBuildableSize(a, locations, roads, {}).width).toBe(scanned);
  });

  it('still refuses to overlap a neighbouring building', () => {
    const a = at('a', 0, 0);
    const near = at('near', 40, 0);
    const solved = maxBuildableSize(a, [a, near], [], {});

    const grown = at('a', 0, 0, { design: { width: solved.width } });
    expect(footprintsIntersect(footprintOf(grown), footprintOf(near), 0)).toBe(false);
  });

  it('leaves an unobstructed building at the design cap', () => {
    const a = at('a', 0, 0);
    expect(maxBuildableSize(a, [a], [], {})).toEqual({
      width: DESIGN_LIMITS.width.max,
      depth: DESIGN_LIMITS.depth.max
    });
  });
});

describe('maxBuildableSize never reports a ceiling below the current size', () => {
  it('holds for a design saved above the limits', () => {
    // Exactly the collapse the user hit: an over-wide building whose depth cap
    // came back as 8 m while the building was 20 m deep.
    const a = at('a', 50, 30, { design: { width: 80, depth: 20 } });
    const locations = [a, at('hub', 0, 0), at('ne', 150, 150), at('east', 250, 0)];
    const roads = [link('r1', 'hub', 'ne', 'main'), link('r2', 'hub', 'east', 'main')];

    const solved = maxBuildableSize(a, locations, roads, {});
    const current = getEffectiveDimensions(a);

    expect(solved.width).toBeGreaterThanOrEqual(current.width);
    expect(solved.depth).toBeGreaterThanOrEqual(current.depth);
  });

  it('holds across a sweep of oversized widths', () => {
    for (const width of [30, 50, 63, 70, 80]) {
      const a = at('a', 50, 30, { design: { width, depth: 20 } });
      const locations = [a, at('hub', 0, 0), at('ne', 150, 150), at('east', 250, 0)];
      const roads = [link('r1', 'hub', 'ne', 'main'), link('r2', 'hub', 'east', 'main')];

      const solved = maxBuildableSize(a, locations, roads, {});
      expect(solved.width, `width cap under handle at ${width}`)
        .toBeGreaterThanOrEqual(width);
      expect(solved.depth, `depth cap under handle at width ${width}`)
        .toBeGreaterThanOrEqual(20);
    }
  });
});
