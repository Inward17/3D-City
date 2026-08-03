import { describe, it, expect } from 'vitest';
import {
  assignTraffic, assignCity, demandForHour, buildLinks, linkTime, linkId,
  bprTime, signalDelay, roundaboutDelay, crossingEffect, compareCrossingStyles,
  SATURATION_FLOW_PER_LANE, SIGNAL_GREEN_SHARE, ROUNDABOUT_ENTRY_CAPACITY,
  ROUNDABOUT_BASE_DELAY, CONVERGENCE_GAP, WEATHER_EFFECT, Demand
} from './assignment';
import { buildRoadNetwork } from './roadNetwork';
import { crossingKey, CrossingStyle } from './roadCrossings';
import { gradeOf, MAX_ROAD_GRADE } from './terrain';
import { FREE_FLOW_SPEED } from './scale';
import { Location, Road } from '../types/city';

const at = (id: string, x: number, z: number, over: Partial<Location> = {}): Location => ({
  id, name: id, type: 'Building', position: [x, 0, z],
  description: '', zone: 'commercial', ...over
});

const link = (id: string, from: string, to: string, type: Road['type'] = 'secondary'): Road => ({
  id, from, to, distance: 100, type
});

/**
 * Two ways from west to east: a short residential street, or a longer pair of
 * main roads via the north. The classic assignment test — as demand grows the
 * short route saturates and traffic starts using the long one.
 */
const twoRoutes = () => {
  /*
    Geometry chosen so the street really is the quicker option when empty:
    400 m at 30 km/h is 48 s, against 2 x 538 m at 50 km/h — 77 s — round the
    north. Being *shorter* is not enough; a slow enough road class loses on time
    even over a shorter distance, which is the point of routing on time.
  */
  const locations = [
    at('west', -200, 0), at('east', 200, 0), at('north', 0, -500)
  ];
  const roads = [
    link('short', 'west', 'east', 'residential'),
    link('longA', 'west', 'north', 'main'),
    link('longB', 'north', 'east', 'main')
  ];
  return { locations, roads, network: buildRoadNetwork(locations, roads, {}) };
};

const demand = (flow: number): Demand[] => [{ fromId: 'west', toId: 'east', flow }];

describe('bprTime', () => {
  it('is the free-flow time on an empty road', () => {
    expect(bprTime(60, 0, 1000)).toBeCloseTo(60, 6);
  });

  it('adds the standard 15% at exactly capacity', () => {
    expect(bprTime(60, 1000, 1000)).toBeCloseTo(69, 6);
  });

  it('degrades sharply beyond capacity', () => {
    expect(bprTime(60, 2000, 1000)).toBeGreaterThan(bprTime(60, 1000, 1000) * 2);
  });

  it('rises monotonically with volume', () => {
    let previous = 0;
    for (let v = 0; v <= 3000; v += 100) {
      const t = bprTime(60, v, 1000);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });

  it('treats a zero-capacity link as impassable', () => {
    expect(bprTime(60, 10, 0)).toBe(Infinity);
  });
});

describe('junction delay models', () => {
  it('makes you wait at signals even when the road is empty', () => {
    expect(signalDelay(0)).toBeGreaterThan(10);
  });

  it('lets you straight into an empty roundabout', () => {
    expect(roundaboutDelay(0)).toBe(ROUNDABOUT_BASE_DELAY);
    expect(roundaboutDelay(0)).toBeLessThan(signalDelay(0));
  });

  it('turns the roundabout into the worse option when busy', () => {
    // The real trade-off: give-way beats signals until the gaps run out.
    expect(roundaboutDelay(0.95)).toBeGreaterThan(signalDelay(0.95));
  });

  it('has a crossover point between the two', () => {
    let crossings = 0;
    let previous = roundaboutDelay(0) < signalDelay(0);
    for (let x = 0; x <= 1; x += 0.01) {
      const now = roundaboutDelay(x) < signalDelay(x);
      if (now !== previous) crossings++;
      previous = now;
    }
    expect(crossings).toBe(1);
  });

  it('costs nothing to cross a grade separation', () => {
    for (const style of ['bridge', 'underpass'] as CrossingStyle[]) {
      const effect = crossingEffect(style, 2);
      expect(effect.delayAt(0)).toBe(0);
      expect(effect.delayAt(0.99)).toBe(0);
      expect(effect.capacity).toBe(Infinity);
    }
  });

  it('gives a signalised approach only its share of the green', () => {
    expect(crossingEffect('signals', 2).capacity)
      .toBeCloseTo(SATURATION_FLOW_PER_LANE * 2 * SIGNAL_GREEN_SHARE, 6);
  });

  it('caps a roundabout arm at its entry capacity', () => {
    expect(crossingEffect('roundabout', 2).capacity).toBe(ROUNDABOUT_ENTRY_CAPACITY);
  });
});

describe('buildLinks', () => {
  it('makes both directions of every road', () => {
    const { network } = twoRoutes();
    const links = buildLinks(network);
    expect(links).toHaveLength(6);
    expect(links.map(l => l.id)).toContain(linkId('short', false));
    expect(links.map(l => l.id)).toContain(linkId('short', true));
  });

  it('gives a main road more capacity than a residential street', () => {
    const { network } = twoRoutes();
    const links = buildLinks(network);
    const main = links.find(l => l.roadId === 'longA')!;
    const street = links.find(l => l.roadId === 'short')!;
    expect(main.capacity).toBeGreaterThan(street.capacity * 3);
  });

  it('lets a junction cap the capacity of the road through it', () => {
    const locations = [
      at('n', 0, -300), at('s', 0, 300), at('e', 300, 0), at('w', -300, 0)
    ];
    const roads = [link('ns', 'n', 's', 'main'), link('ew', 'e', 'w', 'main')];

    const open = buildLinks(buildRoadNetwork(locations, roads, {
      [crossingKey('ew', 'ns')]: 'bridge'
    }));
    const metered = buildLinks(buildRoadNetwork(locations, roads, {
      [crossingKey('ew', 'ns')]: 'signals'
    }));

    const capacityOf = (links: ReturnType<typeof buildLinks>) =>
      links.find(l => l.roadId === 'ns' && !l.reversed)!.capacity;

    expect(capacityOf(metered)).toBeLessThan(capacityOf(open));
  });
});

describe('linkTime', () => {
  it('is free-flow on an empty road with no junctions', () => {
    const { network } = twoRoutes();
    const road = buildLinks(network).find(l => l.roadId === 'short')!;
    expect(linkTime(road, 0)).toBeCloseTo(road.freeFlowTime, 6);
  });

  it('grows with the load', () => {
    const { network } = twoRoutes();
    const road = buildLinks(network).find(l => l.roadId === 'short')!;
    expect(linkTime(road, road.capacity)).toBeGreaterThan(linkTime(road, 0));
  });
});

describe('user equilibrium', () => {
  it('puts everyone on the quickest route when it is empty', () => {
    const { network } = twoRoutes();
    const result = assignTraffic(network, demand(50));

    const short = result.links.find(l => l.roadId === 'short' && !l.reversed)!;
    expect(short.volume).toBeCloseTo(50, 1);
  });

  it('spills traffic onto the long route once the short one saturates', () => {
    /*
      This is the behaviour the whole model exists for. Under all-or-nothing
      assignment every vehicle takes the short street no matter how many there
      are, and no scheme could ever relieve it.
    */
    const { network } = twoRoutes();
    const result = assignTraffic(network, demand(3000));

    const short = result.links.find(l => l.roadId === 'short' && !l.reversed)!;
    const long = result.links.find(l => l.roadId === 'longA' && !l.reversed)!;

    expect(long.volume).toBeGreaterThan(0);
    expect(short.volume + long.volume).toBeCloseTo(3000, 0);
  });

  it('equalises travel time across the routes people actually use', () => {
    // Wardrop's first principle: no used route is slower than any other.
    const { network } = twoRoutes();
    const result = assignTraffic(network, demand(3000));

    const timeOf = (roadIds: string[]) => roadIds.reduce((sum, id) => {
      const l = result.links.find(x => x.roadId === id && !x.reversed)!;
      return sum + l.time;
    }, 0);

    const shortTime = timeOf(['short']);
    const longTime = timeOf(['longA', 'longB']);

    expect(Math.abs(shortTime - longTime) / shortTime).toBeLessThan(0.05);
  });

  it('converges', () => {
    const { network } = twoRoutes();
    const result = assignTraffic(network, demand(3000));
    expect(result.relativeGap).toBeLessThanOrEqual(CONVERGENCE_GAP);
  });

  it('conserves demand', () => {
    const { network } = twoRoutes();
    const result = assignTraffic(network, demand(1200));

    // Everything leaving west must arrive at east.
    const leavingWest = result.links
      .filter(l => l.from === 'west')
      .reduce((sum, l) => sum + l.volume, 0);
    expect(leavingWest).toBeCloseTo(1200, 0);
  });

  it('reports a total travel time that rises with demand', () => {
    const { network } = twoRoutes();
    const light = assignTraffic(network, demand(200)).totalTravelTime;
    const heavy = assignTraffic(network, demand(2500)).totalTravelTime;
    expect(heavy).toBeGreaterThan(light);
  });

  it('is deterministic', () => {
    const { network } = twoRoutes();
    const a = assignTraffic(network, demand(1500));
    const b = assignTraffic(network, demand(1500));
    expect(a.links.map(l => l.volume)).toEqual(b.links.map(l => l.volume));
  });

  it('handles a movement with no route at all', () => {
    const locations = [at('a', -300, 0), at('b', 0, 0), at('island', 0, 500)];
    const network = buildRoadNetwork(locations, [link('ab', 'a', 'b')], {});
    const result = assignTraffic(network, [{ fromId: 'a', toId: 'island', flow: 100 }]);

    expect(result.links.every(l => l.volume === 0)).toBe(true);
    expect(result.trips).toHaveLength(0);
  });

  it('handles an empty city', () => {
    const result = assignTraffic(buildRoadNetwork([], [], {}), []);
    expect(result.links).toHaveLength(0);
    expect(result.totalTravelTime).toBe(0);
  });
});

describe('the junction style changes the outcome', () => {
  /*
    The payoff. Under free-flow routing a signalised crossing, a roundabout and
    a bridge produced byte-identical traffic, so the choice the UI offers could
    not affect a single number.
  */
  const crossingCity = (style: CrossingStyle) => {
    const locations = [
      at('west', -400, 0), at('east', 400, 0),
      at('north', 0, -400), at('south', 0, 400)
    ];
    const roads = [
      link('ew', 'west', 'east', 'main'),
      link('ns', 'north', 'south', 'main')
    ];
    const network = buildRoadNetwork(locations, roads, {
      [crossingKey('ew', 'ns')]: style
    });
    return assignTraffic(network, [
      { fromId: 'west', toId: 'east', flow: 1200 },
      { fromId: 'north', toId: 'south', flow: 1200 }
    ]);
  };

  it('costs less time to cross a bridge than a set of signals', () => {
    expect(crossingCity('bridge').totalTravelTime)
      .toBeLessThan(crossingCity('signals').totalTravelTime);
  });

  it('leaves the crossing roads unsaturated when grade separated', () => {
    const bridged = crossingCity('bridge');
    const signalised = crossingCity('signals');

    const worst = (a: ReturnType<typeof crossingCity>) =>
      Math.max(...a.links.map(l => l.saturation));

    expect(worst(bridged)).toBeLessThan(worst(signalised));
  });

  it('gives every style a different total travel time', () => {
    const totals = (['signals', 'roundabout', 'bridge'] as CrossingStyle[])
      .map(s => Math.round(crossingCity(s).totalTravelTime * 1000));
    expect(new Set(totals).size).toBe(3);
  });

  it('prefers a roundabout to signals when the crossing is quiet', () => {
    const quiet = (style: CrossingStyle) => {
      const locations = [
        at('west', -400, 0), at('east', 400, 0),
        at('north', 0, -400), at('south', 0, 400)
      ];
      const roads = [
        link('ew', 'west', 'east', 'main'),
        link('ns', 'north', 'south', 'main')
      ];
      const network = buildRoadNetwork(locations, roads, {
        [crossingKey('ew', 'ns')]: style
      });
      return assignTraffic(network, [{ fromId: 'west', toId: 'east', flow: 80 }]);
    };

    expect(quiet('roundabout').totalTravelTime)
      .toBeLessThan(quiet('signals').totalTravelTime);
  });
});

describe('compareCrossingStyles', () => {
  const setup = () => {
    const locations = [
      at('west', -400, 0), at('east', 400, 0),
      at('north', 0, -400), at('south', 0, 400)
    ];
    const roads = [
      link('ew', 'west', 'east', 'main'),
      link('ns', 'north', 'south', 'main')
    ];
    const network = buildRoadNetwork(locations, roads, {});
    const assignment = assignTraffic(network, [
      { fromId: 'west', toId: 'east', flow: 1400 }
    ]);
    return { crossing: network.crossings[0], assignment };
  };

  it('offers all four styles', () => {
    const { crossing, assignment } = setup();
    expect(compareCrossingStyles(crossing, assignment, 'main').map(o => o.style))
      .toEqual(['signals', 'roundabout', 'bridge', 'underpass']);
  });

  it('shows grade separation as the zero-delay option', () => {
    const { crossing, assignment } = setup();
    const options = compareCrossingStyles(crossing, assignment, 'main');
    expect(options.find(o => o.style === 'bridge')!.delay).toBe(0);
  });

  it('shows a real delay for the at-grade options', () => {
    const { crossing, assignment } = setup();
    const options = compareCrossingStyles(crossing, assignment, 'main');
    for (const style of ['signals', 'roundabout']) {
      expect(options.find(o => o.style === style)!.delay).toBeGreaterThan(0);
    }
  });
});

describe('assignCity on a real layout', () => {
  it('loads the roads unevenly and converges', async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const network = buildRoadNetwork(
      cityPlanningData.locations, cityPlanningData.roads, {}
    );
    const result = assignCity(network, cityPlanningData.locations, 9, 40);

    expect(result.relativeGap).toBeLessThanOrEqual(CONVERGENCE_GAP);

    const volumes = result.links.map(l => l.volume).filter(v => v > 0);
    expect(volumes.length).toBeGreaterThan(0);
    expect(Math.max(...volumes)).toBeGreaterThan(Math.min(...volumes) * 5);
  });

  it('derives demand that matches the trip model', async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const network = buildRoadNetwork(
      cityPlanningData.locations, cityPlanningData.roads, {}
    );
    const morning = demandForHour(network, cityPlanningData.locations, 9, 40);
    const night = demandForHour(network, cityPlanningData.locations, 3, 40);

    const total = (d: Demand[]) => d.reduce((sum, x) => sum + x.flow, 0);
    expect(total(morning)).toBeGreaterThan(total(night));
  });
});

describe('weather', () => {
  const wet = (weather: 'clear' | 'rain' | 'snow') => {
    const { network } = twoRoutes();
    return assignTraffic(network, demand(600), { weather });
  };

  it('cuts capacity when it rains', () => {
    const { network } = twoRoutes();
    const dry = buildLinks(network, 'clear')[0].capacity;
    const rain = buildLinks(network, 'rain')[0].capacity;
    expect(rain).toBeLessThan(dry);
    expect(rain).toBeCloseTo(dry * WEATHER_EFFECT.rain.capacity, 6);
  });

  it('cuts it further in snow', () => {
    const { network } = twoRoutes();
    expect(buildLinks(network, 'snow')[0].capacity)
      .toBeLessThan(buildLinks(network, 'rain')[0].capacity);
  });

  it('slows the free-flow speed too', () => {
    const { network } = twoRoutes();
    const dry = buildLinks(network, 'clear')[0].freeFlowTime;
    const snow = buildLinks(network, 'snow')[0].freeFlowTime;
    expect(snow).toBeGreaterThan(dry);
  });

  it('costs the city travel time', () => {
    // The whole point of coupling it: weather was a particle effect wired to
    // nothing, so a snowstorm changed no number anywhere.
    expect(wet('rain').totalTravelTime).toBeGreaterThan(wet('clear').totalTravelTime);
    expect(wet('snow').totalTravelTime).toBeGreaterThan(wet('rain').totalTravelTime);
  });

  it('pushes roads closer to capacity on the same demand', () => {
    const worst = (a: ReturnType<typeof wet>) => Math.max(...a.links.map(l => l.saturation));
    expect(worst(wet('snow'))).toBeGreaterThan(worst(wet('clear')));
  });

  it('defaults to clear', () => {
    const { network } = twoRoutes();
    expect(assignTraffic(network, demand(600)).totalTravelTime)
      .toBeCloseTo(wet('clear').totalTravelTime, 6);
  });
});

describe('the shipped layouts are networks, not stars', () => {
  /*
    Both templates used to be pure trees radiating from one hub, so every
    journey between any two buildings was forced through the middle of the map.
    That is not how traffic behaves, and it also left the assignment nothing to
    decide: with one possible route, congestion cannot redistribute anything.
  */
  const templates = async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const { corporateCampusData } = await import('../data/corporateCampusData');
    return [
      ['city planning', cityPlanningData] as const,
      ['corporate campus', corporateCampusData] as const
    ];
  };

  it('contain at least one cycle, so journeys have a choice of route', async () => {
    for (const [name, data] of await templates()) {
      const connected = new Set<string>();
      for (const road of data.roads) {
        connected.add(road.from);
        connected.add(road.to);
      }
      // A tree on n nodes has exactly n - 1 edges; more means a cycle exists.
      expect(data.roads.length, `${name} is still a tree`)
        .toBeGreaterThan(connected.size - 1);
    }
  });

  it('leave no building without a road', async () => {
    for (const [name, data] of await templates()) {
      const connected = new Set<string>();
      for (const road of data.roads) {
        connected.add(road.from);
        connected.add(road.to);
      }
      const isolated = data.locations.filter(l => !connected.has(l.id)).map(l => l.name);
      expect(isolated, `${name} has isolated buildings`).toEqual([]);
    }
  });

  it('route traffic between outer districts without touching the hub', async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const network = buildRoadNetwork(
      cityPlanningData.locations, cityPlanningData.roads, {}
    );
    const assignment = assignCity(network, cityPlanningData.locations, 9, 40);

    // Library to Hospital sit on opposite sides of City Hall. The orbital is
    // the direct way round; through the centre is a detour.
    const trip = assignment.trips.find(t => t.fromId === 'edu1' && t.toId === 'health1');
    expect(trip).toBeDefined();
    expect(trip!.route.nodes, 'still routed through City Hall').not.toContain('gov1');
  });

  it('spread load off the hub', async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const network = buildRoadNetwork(
      cityPlanningData.locations, cityPlanningData.roads, {}
    );
    const assignment = assignCity(network, cityPlanningData.locations, 9, 40);

    const throughHub = assignment.links
      .filter(l => l.from === 'gov1' || l.to === 'gov1')
      .reduce((sum, l) => sum + l.volume, 0);
    const total = assignment.links.reduce((sum, l) => sum + l.volume, 0);

    // Some traffic genuinely wants the centre; not all of it should be there.
    expect(throughHub / total).toBeLessThan(0.75);
  });
});

describe('gradient', () => {
  /*
    Roads follow the ground, so a route across a hillside costs more than the
    same distance on the flat. Without this, terrain would be scenery: the
    assignment would price a climb and a level run identically.
  */
  const hilly = () => {
    const locations = [at('low', -300, 0), at('high', 300, 0)];
    return buildRoadNetwork(locations, [link('ab', 'low', 'high', 'main')], {});
  };

  it('charges the uphill direction more than the downhill one', () => {
    const links = buildLinks(hilly());
    const forward = links.find(l => !l.reversed)!;
    const reverse = links.find(l => l.reversed)!;

    // Same tarmac, same length — the difference is which way the hill runs.
    expect(forward.length).toBeCloseTo(reverse.length, 6);
    expect(forward.freeFlowTime).not.toBeCloseTo(reverse.freeFlowTime, 2);
  });

  it('never makes the downhill direction faster than the level equivalent', () => {
    const links = buildLinks(hilly());
    const level = links[0].length / FREE_FLOW_SPEED.main;
    for (const l of links) {
      expect(l.freeFlowTime).toBeGreaterThanOrEqual(level - 1e-6);
    }
  });

  it('costs capacity in the climbing direction', () => {
    const links = buildLinks(hilly());
    const capacities = links.map(l => l.capacity);
    expect(Math.min(...capacities)).toBeLessThan(Math.max(...capacities));
  });

  it('leaves the shipped layout with drivable gradients', async () => {
    const { cityPlanningData } = await import('../data/cityPlanningData');
    const network = buildRoadNetwork(
      cityPlanningData.locations, cityPlanningData.roads, {}
    );

    for (const entry of network.roads) {
      const grade = gradeOf(entry.path);
      expect(Math.abs(grade.overall), `${entry.road.id} end to end`)
        .toBeLessThan(MAX_ROAD_GRADE);
    }
  });
});
