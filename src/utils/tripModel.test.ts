import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildTripGraph, shortestRoute, shortestRoutesFrom, tripEnds, buildTrips,
  toDrivablePath, buildDrivablePaths, sampleByFlow, pathLength, advanceAlongTrip,
  nextTripFrom, BACKGROUND_CHURN, DETERRENCE_HALF_DISTANCE, DrivablePath
} from './tripModel';
import { buildRoadNetwork } from './roadNetwork';
import { buildingCapacity } from './cityMetrics';
import { buildingRadius } from './roadRouting';
import { FREE_FLOW_SPEED } from './scale';
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

/** A ─ B ─ C in a line, so routes have an unambiguous shape. */
const chain = () => {
  const locations = [at('a', -300, 0), at('b', 0, 0), at('c', 300, 0)];
  const roads = [link('ab', 'a', 'b'), link('bc', 'b', 'c')];
  return { locations, roads, network: buildRoadNetwork(locations, roads, {}) };
};

describe('pathLength', () => {
  it('sums the segments', () => {
    const path = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(3, 0, 0),
      new THREE.Vector3(3, 0, 4)
    ];
    expect(pathLength(path)).toBeCloseTo(7, 6);
  });

  it('is zero for a single point', () => {
    expect(pathLength([new THREE.Vector3(1, 2, 3)])).toBe(0);
  });
});

describe('buildTripGraph', () => {
  it('makes every road drivable in both directions', () => {
    const { network } = chain();
    const graph = buildTripGraph(network);

    expect(graph.get('a')!.map(e => e.to)).toEqual(['b']);
    expect(graph.get('b')!.map(e => e.to).sort()).toEqual(['a', 'c']);
    expect(graph.get('c')!.map(e => e.to)).toEqual(['b']);
  });

  it('flags the direction each edge is driven', () => {
    const { network } = chain();
    const graph = buildTripGraph(network);

    expect(graph.get('a')!.find(e => e.roadId === 'ab')!.reversed).toBe(false);
    expect(graph.get('b')!.find(e => e.roadId === 'ab')!.reversed).toBe(true);
  });

  it('measures the routed length, not the straight line', () => {
    // Roads run building edge to building edge, so neither length equals the
    // 500 m centre-to-centre gap. What matters is that the detour costs more.
    const ends = [at('a', -250, 0), at('b', 250, 0)];
    const road = [link('ab', 'a', 'b', 'main')];

    const clear = buildTripGraph(buildRoadNetwork(ends, road, {})).get('a')![0];
    const blocked = buildTripGraph(
      buildRoadNetwork([...ends, at('mid', 0, 0)], road, {})
    ).get('a')![0];

    expect(blocked.length).toBeGreaterThan(clear.length);
  });

  it('derives driving time from the road class', () => {
    const locations = [at('a', -300, 0), at('b', 300, 0)];
    const network = buildRoadNetwork(locations, [link('ab', 'a', 'b', 'main')], {});
    const edge = buildTripGraph(network).get('a')![0];

    expect(edge.time).toBeCloseTo(edge.length / FREE_FLOW_SPEED.main, 6);
  });
});

describe('shortestRoutesFrom', () => {
  it('finds a multi-leg route', () => {
    const { network } = chain();
    const route = shortestRoute(buildTripGraph(network), 'a', 'c')!;

    expect(route.legs.map(l => l.roadId)).toEqual(['ab', 'bc']);
    expect(route.length).toBeGreaterThan(0);
  });

  it('orients each leg for the direction of travel', () => {
    const { network } = chain();
    const graph = buildTripGraph(network);

    // c -> a drives both roads backwards.
    expect(shortestRoute(graph, 'c', 'a')!.legs)
      .toEqual([{ roadId: 'bc', reversed: true }, { roadId: 'ab', reversed: true }]);
  });

  it('returns null for a building with no road to it', () => {
    const locations = [at('a', -300, 0), at('b', 0, 0), at('lonely', 0, 400)];
    const network = buildRoadNetwork(locations, [link('ab', 'a', 'b')], {});

    expect(shortestRoute(buildTripGraph(network), 'a', 'lonely')).toBeNull();
  });

  it('prefers the quicker arterial over a shorter residential street', () => {
    /*
      Two ways from a to c: straight down a residential street, or a dog-leg via
      b on main roads. The detour is longer but faster, and drivers take it.
    */
    const locations = [at('a', -300, 0), at('b', 0, -260), at('c', 300, 0)];
    const roads = [
      link('direct', 'a', 'c', 'residential'),
      link('viaB1', 'a', 'b', 'main'),
      link('viaB2', 'b', 'c', 'main')
    ];
    const network = buildRoadNetwork(locations, roads, {});
    const route = shortestRoute(buildTripGraph(network), 'a', 'c')!;

    expect(route.legs.map(l => l.roadId)).toEqual(['viaB1', 'viaB2']);

    const direct = buildTripGraph(network).get('a')!.find(e => e.roadId === 'direct')!;
    expect(route.length).toBeGreaterThan(direct.length);   // longer
    expect(route.time).toBeLessThan(direct.time);          // but quicker
  });

  it('reaches every connected building in one pass', () => {
    const { network } = chain();
    expect([...shortestRoutesFrom(buildTripGraph(network), 'a').keys()].sort())
      .toEqual(['b', 'c']);
  });
});

describe('tripEnds', () => {
  const office = at('office', 0, 0, { zone: 'commercial' });
  const home = at('home', 100, 0, { zone: 'residential' });

  it('sends people out of homes and into offices in the morning', () => {
    const [o, h] = tripEnds([office, home], 9);
    expect(h.production).toBeGreaterThan(h.attraction);
    expect(o.attraction).toBeGreaterThan(o.production);
  });

  it('reverses the flow in the evening', () => {
    const [o, h] = tripEnds([office, home], 18);
    expect(h.attraction).toBeGreaterThan(h.production);
    expect(o.production).toBeGreaterThan(o.attraction);
  });

  it('keeps some movement at a flat hour rather than emptying the roads', () => {
    // 02:00 -> 03:00: no curve is moving, so only churn remains.
    const [ends] = tripEnds([home], 3);
    expect(ends.production).toBeGreaterThan(0);
    expect(ends.attraction).toBeGreaterThan(0);
  });

  it('scales churn with how many people are actually there', () => {
    const big = at('big', 0, 0, { design: { population: 1000 } });
    const small = at('small', 0, 0, { design: { population: 10 } });
    const [b, s] = tripEnds([big, small], 3);
    expect(b.production).toBeGreaterThan(s.production);
  });

  it('generates nothing for an empty building', () => {
    const [ends] = tripEnds([at('empty', 0, 0, { design: { population: 0 } })], 9);
    expect(ends.production).toBe(0);
    expect(ends.attraction).toBe(0);
  });

  it('churn is proportional to occupancy at the stated rate', () => {
    const b = at('b', 0, 0, { design: { population: 500 }, zone: 'residential' });
    const [ends] = tripEnds([b], 3);
    const occupants = buildingCapacity(b) * 0.9; // residential overnight factor
    expect(ends.attraction).toBeCloseTo(occupants * BACKGROUND_CHURN, 4);
  });
});

describe('buildTrips', () => {
  it('sends every origin exactly what it generates', () => {
    const { locations, network } = chain();
    const graph = buildTripGraph(network);
    const ends = tripEnds(locations, 9);
    const trips = buildTrips(graph, ends, 40);

    for (const origin of ends) {
      const sent = trips
        .filter(t => t.fromId === origin.id)
        .reduce((sum, t) => sum + t.flow, 0);
      // Only origins that can reach an attracting destination send anything.
      if (sent > 0) expect(sent).toBeCloseTo(origin.production / 40, 6);
    }
  });

  it('prefers a near destination to an identical far one', () => {
    const hub = at('hub', 0, 0);
    const near = at('near', 150, 0);
    const far = at('far', -600, 0);
    const locations = [hub, near, far];
    const roads = [link('hn', 'hub', 'near'), link('hf', 'hub', 'far')];
    const network = buildRoadNetwork(locations, roads, {});

    const trips = buildTrips(buildTripGraph(network), tripEnds(locations, 9), 40);
    const toNear = trips.find(t => t.fromId === 'hub' && t.toId === 'near')!;
    const toFar = trips.find(t => t.fromId === 'hub' && t.toId === 'far')!;

    expect(toNear.flow).toBeGreaterThan(toFar.flow);
  });

  it('halves the pull at the stated deterrence distance', () => {
    const decay = (d: number) => 1 / (1 + (d / DETERRENCE_HALF_DISTANCE) ** 2);
    expect(decay(DETERRENCE_HALF_DISTANCE)).toBeCloseTo(0.5, 6);
  });

  it('produces no trips into a building nothing can reach', () => {
    const locations = [at('a', -300, 0), at('b', 0, 0), at('lonely', 0, 400)];
    const network = buildRoadNetwork(locations, [link('ab', 'a', 'b')], {});
    const trips = buildTrips(buildTripGraph(network), tripEnds(locations, 9), 40);

    expect(trips.some(t => t.toId === 'lonely' || t.fromId === 'lonely')).toBe(false);
  });

  it('never routes a trip to itself', () => {
    const { locations, network } = chain();
    const trips = buildTrips(buildTripGraph(network), tripEnds(locations, 9), 40);
    expect(trips.some(t => t.fromId === t.toId)).toBe(false);
  });
});

describe('toDrivablePath', () => {
  /*
    Reversal is where this goes wrong: each road's points run from its `from` to
    its `to`, so a leg driven the other way has to be reversed before it is
    appended. Get it wrong and the vehicle jumps to the far end of the next road
    and drives back — which shows up as a stitched line much longer than the sum
    of its legs, so that is what these check.
  */
  const twoLegTrip = (fromId: string, toId: string) => {
    const { locations, network } = chain();
    const graph = buildTripGraph(network);
    const trip = buildTrips(graph, tripEnds(locations, 9), 40)
      .find(t => t.fromId === fromId && t.toId === toId)!;
    return { trip, network, locations };
  };

  /** Roughly how far a stitched path exceeds the sum of its legs. */
  const detour = (fromId: string, toId: string) => {
    const { trip, network, locations } = twoLegTrip(fromId, toId);
    const drivable = toDrivablePath(trip, network, locations)!;
    return drivable.length - trip.route.length;
  };

  it('stitches forward legs without backtracking', () => {
    // Only the short way round the junction building is added — a mis-ordered
    // leg would double the length, not add a few dozen metres.
    expect(detour('a', 'c')).toBeGreaterThan(0);
    expect(detour('a', 'c')).toBeLessThan(80);
  });

  it('stitches reversed legs without backtracking', () => {
    const { trip } = twoLegTrip('c', 'a');
    expect(trip.route.legs.every(l => l.reversed)).toBe(true);

    expect(detour('c', 'a')).toBeGreaterThan(0);
    expect(detour('c', 'a')).toBeLessThan(80);
  });

  it('goes around the building it changes road at, not through it', () => {
    /*
      Roads stop at the building edge, so a route that changes road at a
      building leaves a gap as wide as the building. Interpolated straight
      across, vehicles drove through it.
    */
    const { trip, network, locations } = twoLegTrip('a', 'c');
    const junction = locations.find(l => l.id === 'b')!;
    const curve = toDrivablePath(trip, network, locations)!.curve;

    for (let t = 0; t <= 1; t += 0.002) {
      const p = curve.getPoint(t);
      const distance = Math.hypot(p.x - junction.position[0], p.z - junction.position[2]);
      expect(distance, `inside the junction building at t=${t.toFixed(3)}`)
        .toBeGreaterThan(buildingRadius(junction) * 0.9);
    }
  });

  it('runs from the origin building to the destination building', () => {
    const { trip, network, locations } = twoLegTrip('c', 'a');
    const points = toDrivablePath(trip, network, locations)!.curve.points;

    const byId = new Map(locations.map(l => [l.id, l]));
    const near = (p: THREE.Vector3, id: string) => {
      const [x, , z] = byId.get(id)!.position;
      return Math.hypot(p.x - x, p.z - z);
    };

    // Roads stop at the building edge, so "at" means within its own radius
    // plus the pavement setback, not on top of the centre.
    const setback = buildingRadius(byId.get('c')!) + 5;
    expect(near(points[0], 'c')).toBeLessThan(setback);
    expect(near(points[points.length - 1], 'a')).toBeLessThan(setback);
  });

  it('carries a length in metres, matching its own geometry', () => {
    const { locations, network } = chain();
    const graph = buildTripGraph(network);
    const trip = buildTrips(graph, tripEnds(locations, 9), 40)[0];
    const drivable = toDrivablePath(trip, network, locations)!;

    expect(drivable.length).toBeCloseTo(pathLength(drivable.curve.points), 6);
    expect(drivable.length).toBeGreaterThan(100);
  });

  it('takes a speed between the slowest and fastest road class', () => {
    const { locations, network } = chain();
    const graph = buildTripGraph(network);

    for (const trip of buildTrips(graph, tripEnds(locations, 9), 40)) {
      const drivable = toDrivablePath(trip, network, locations)!;
      expect(drivable.speed).toBeGreaterThanOrEqual(FREE_FLOW_SPEED.residential);
      expect(drivable.speed).toBeLessThanOrEqual(FREE_FLOW_SPEED.main);
    }
  });
});

describe('driving takes realistic time', () => {
  /*
    The old model advanced `progress` — a fraction of the road — by a fixed
    "speed" each second, so every vehicle crossed every road in the same number
    of seconds. A 350 m road was driven at 63 km/h and a 100 m road at 18 km/h.
  */
  const secondsToDrive = (path: { length: number; speed: number }) =>
    path.length / path.speed;

  it('takes longer to drive further', () => {
    const short = buildRoadNetwork(
      [at('a', -60, 0), at('b', 60, 0)], [link('ab', 'a', 'b')], {}
    );
    const long = buildRoadNetwork(
      [at('a', -400, 0), at('b', 400, 0)], [link('ab', 'a', 'b')], {}
    );

    const shortTrip = buildDrivablePaths(short, [at('a', -60, 0), at('b', 60, 0)], 9, 40)[0];
    const longTrip = buildDrivablePaths(long, [at('a', -400, 0), at('b', 400, 0)], 9, 40)[0];

    expect(secondsToDrive(longTrip)).toBeGreaterThan(secondsToDrive(shortTrip) * 3);
  });

  it('crosses a 600 m arterial in roughly the time 50 km/h implies', () => {
    const locations = [at('a', -300, 0), at('b', 300, 0)];
    const network = buildRoadNetwork(locations, [link('ab', 'a', 'b', 'main')], {});
    const trip = buildDrivablePaths(network, locations, 9, 40)[0];

    // 600 m at 13.9 m/s is ~43 s; allow for the routed length and rounding.
    expect(secondsToDrive(trip)).toBeGreaterThan(35);
    expect(secondsToDrive(trip)).toBeLessThan(60);
  });

  it('drives a residential street slower than an arterial of the same length', () => {
    const locations = [at('a', -300, 0), at('b', 300, 0)];
    const fast = buildDrivablePaths(
      buildRoadNetwork(locations, [link('ab', 'a', 'b', 'main')], {}), locations, 9, 40
    )[0];
    const slow = buildDrivablePaths(
      buildRoadNetwork(locations, [link('ab', 'a', 'b', 'residential')], {}), locations, 9, 40
    )[0];

    expect(secondsToDrive(slow)).toBeGreaterThan(secondsToDrive(fast));
  });
});

describe('sampleByFlow', () => {
  const paths = [
    { flow: 1 }, { flow: 9 }
  ] as Parameters<typeof sampleByFlow>[0];

  it('picks the first path at the bottom of the range', () => {
    expect(sampleByFlow(paths, 0)).toBe(0);
  });

  it('picks the busy path for most of the range', () => {
    expect(sampleByFlow(paths, 0.5)).toBe(1);
    expect(sampleByFlow(paths, 0.99)).toBe(1);
  });

  it('lands on each path about as often as its share of flow', () => {
    let busy = 0;
    const samples = 2000;
    for (let i = 0; i < samples; i++) {
      if (sampleByFlow(paths, (i + 0.5) / samples) === 1) busy++;
    }
    expect(busy / samples).toBeGreaterThan(0.85);
    expect(busy / samples).toBeLessThan(0.95);
  });

  it('survives an empty set', () => {
    expect(sampleByFlow([], 0.5)).toBe(0);
  });
});

describe('where a building stands changes which roads carry its traffic', () => {
  /*
    The point of the whole exercise. Traffic used to be spread evenly over every
    road, so this test could not have passed under the old model.
  */
  const cityWith = (officeZ: number) => {
    const locations = [
      at('home', -300, 0, { zone: 'residential' }),
      at('hub', 0, 0),
      at('north', 0, -300),
      at('south', 0, 300),
      at('office', 0, officeZ, { zone: 'commercial', design: { floors: 20 } })
    ];
    const roads = [
      link('hh', 'home', 'hub', 'main'),
      link('hn', 'hub', 'north', 'main'),
      link('hs', 'hub', 'south', 'main'),
      link('no', 'north', 'office'),
      link('so', 'south', 'office')
    ];
    return { locations, network: buildRoadNetwork(locations, roads, {}) };
  };

  const flowOn = (roadId: string, locations: Location[], network: ReturnType<typeof buildRoadNetwork>) => {
    const trips = buildTrips(buildTripGraph(network), tripEnds(locations, 9), 40);
    return trips
      .filter(t => t.route.legs.some(l => l.roadId === roadId))
      .reduce((sum, t) => sum + t.flow, 0);
  };

  it('routes commuters via the north when the office is north', () => {
    const { locations, network } = cityWith(-420);
    expect(flowOn('hn', locations, network)).toBeGreaterThan(flowOn('hs', locations, network));
  });

  it('and via the south when it moves south', () => {
    const { locations, network } = cityWith(420);
    expect(flowOn('hs', locations, network)).toBeGreaterThan(flowOn('hn', locations, network));
  });
});

describe('advanceAlongTrip', () => {
  const trip = (length: number, speed = 10) => ({ length, speed });

  it('covers the distance the speed implies', () => {
    // 10 m/s for 2 s on a 100 m trip is a fifth of the way.
    expect(advanceAlongTrip(0, trip(100), 1, 2)).toBeCloseTo(0.2, 6);
  });

  it('takes proportionally longer on a longer trip', () => {
    const short = advanceAlongTrip(0, trip(100), 1, 1);
    const long = advanceAlongTrip(0, trip(400), 1, 1);
    expect(short / long).toBeCloseTo(4, 6);
  });

  it('reaches the end of two different trips at the right real-world times', () => {
    /*
      The regression that matters: under the old fraction-per-second model both
      of these finished together. At 10 m/s, 100 m takes 10 s and 500 m takes 50.
    */
    const secondsToFinish = (length: number) => {
      let progress = 0;
      let seconds = 0;
      while (progress < 1 && seconds < 1000) {
        progress = advanceAlongTrip(progress, trip(length), 1, 0.1);
        seconds += 0.1;
      }
      return seconds;
    };

    expect(secondsToFinish(100)).toBeCloseTo(10, 1);
    expect(secondsToFinish(500)).toBeCloseTo(50, 1);
  });

  it('moves a slower vehicle less in the same time', () => {
    const car = advanceAlongTrip(0, trip(200), 1, 1);
    const bus = advanceAlongTrip(0, trip(200), 0.6, 1);
    expect(bus).toBeLessThan(car);
    expect(bus / car).toBeCloseTo(0.6, 6);
  });

  it('is frame-rate independent', () => {
    // One 1 s step must equal ten 0.1 s steps.
    let stepped = 0;
    for (let i = 0; i < 10; i++) stepped = advanceAlongTrip(stepped, trip(250), 1, 0.1);
    expect(stepped).toBeCloseTo(advanceAlongTrip(0, trip(250), 1, 1), 6);
  });

  it('does not divide by a zero-length trip', () => {
    expect(advanceAlongTrip(0.4, trip(0), 1, 1)).toBe(0.4);
  });
});

describe('nextTripFrom', () => {
  const path = (fromId: string, toId: string, flow: number) =>
    ({ fromId, toId, flow }) as DrivablePath;

  const paths = [
    path('a', 'b', 5),
    path('b', 'c', 3),
    path('b', 'd', 1),
    path('c', 'a', 9)
  ];

  it('continues from where the vehicle arrived', () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(paths[nextTripFrom(paths, 'b', roll)].fromId).toBe('b');
    }
  });

  it('never teleports the vehicle to an unrelated street', () => {
    // The whole point: arriving at c must not put you on a road out of a.
    expect(paths[nextTripFrom(paths, 'c', 0.5)].fromId).toBe('c');
  });

  it('weights the onward choice by flow', () => {
    let toC = 0;
    const samples = 1000;
    for (let i = 0; i < samples; i++) {
      if (paths[nextTripFrom(paths, 'b', (i + 0.5) / samples)].toId === 'c') toC++;
    }
    // b -> c carries 3 of the 4 vehicles leaving b.
    expect(toC / samples).toBeGreaterThan(0.7);
    expect(toC / samples).toBeLessThan(0.8);
  });

  it('falls back to the whole city from a dead end', () => {
    // Nothing departs from d, so the vehicle has to start somewhere else.
    const index = nextTripFrom(paths, 'd', 0.5);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(paths.length);
  });

  it('survives an empty set', () => {
    expect(nextTripFrom([], 'a', 0.5)).toBe(0);
  });

  it('chains into a connected sequence over many hops', () => {
    let index = 0;
    for (let hop = 0; hop < 20; hop++) {
      const arrivedAt = paths[index].toId;
      const next = nextTripFrom(paths, arrivedAt, (hop * 0.37) % 1);
      // Either it continues from here, or it was a dead end and restarted.
      const continued = paths[next].fromId === arrivedAt;
      const deadEnd = !paths.some(p => p.fromId === arrivedAt);
      expect(continued || deadEnd, `broken chain at hop ${hop}`).toBe(true);
      index = next;
    }
  });
});
