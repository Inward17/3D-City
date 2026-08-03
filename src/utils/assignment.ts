import { Location } from '../types/city';
import { RoadNetwork } from './roadNetwork';
import { Crossing, CrossingStyle } from './roadCrossings';
import { buildTripGraph, tripEnds, buildTrips, pathLength, Trip } from './tripModel';
import { FREE_FLOW_SPEED } from './scale';
import { gradeOf, gradeFactors } from './terrain';

/**
 * Traffic assignment.
 *
 * The trip model routes everyone down the quickest free-flow path and leaves it
 * there, however many of them there are. That makes congestion impossible: a
 * road carries whatever is thrown at it at the same speed, so widening a road,
 * adding a bypass or changing a junction cannot alter a single travel time.
 *
 * Here roads have a capacity, travel time rises as they fill, and drivers
 * re-choose their routes until nobody can go faster by switching — Wardrop's
 * user equilibrium, found by Frank-Wolfe. That is what a transport model is for,
 * and it is what finally connects the junction styles to an outcome: a
 * signalised crossing only gets a share of the green, a roundabout gives way,
 * and a grade separation does neither.
 *
 * Still simplified: demand is fixed rather than responding to congestion (no
 * peak spreading, no mode shift), and turning movements within a junction are
 * not modelled separately.
 */

export type Weather = 'clear' | 'rain' | 'snow';

/**
 * What the weather does to a road.
 *
 * Wet and snow-covered surfaces cost both capacity — drivers leave bigger gaps,
 * so fewer vehicles pass a point per hour — and speed. Values follow the
 * Highway Capacity Manual's weather adjustment factors for heavy rain and light
 * snow; they are the reason a network that copes on a dry Tuesday fails on a
 * wet one.
 *
 * This is what makes the weather control a planning variable rather than a
 * particle effect: it was three sprite states wired to nothing at all.
 */
export const WEATHER_EFFECT: Record<Weather, { capacity: number; speed: number }> = {
  clear: { capacity: 1.0, speed: 1.0 },
  rain: { capacity: 0.86, speed: 0.93 },
  snow: { capacity: 0.74, speed: 0.84 }
};

/** Vehicles per hour one lane can discharge at saturation. */
export const SATURATION_FLOW_PER_LANE = 1800;

/** Lanes per direction implied by each carriageway width in ROAD_WIDTH. */
export const LANES_PER_DIRECTION: Record<string, number> = {
  main: 2,        // 14 m dual two-lane
  secondary: 1,   // 9 m, one lane each way
  residential: 1  // 6 m, single lane with passing places
};

/**
 * Residential streets are not a full lane each way — traffic has to give way to
 * oncoming vehicles, so the usable capacity is well under one lane's worth.
 */
export const RESIDENTIAL_CAPACITY_FACTOR = 0.45;

/** Bureau of Public Roads volume-delay parameters; the standard defaults. */
export const BPR_ALPHA = 0.15;
export const BPR_BETA = 4;

/** Signal timing used by the delay model. */
export const SIGNAL_CYCLE = 90;
export const SIGNAL_GREEN_SHARE = 0.45;

/** Entry capacity of one roundabout arm, vehicles per hour. */
export const ROUNDABOUT_ENTRY_CAPACITY = 1300;

/** Delay entering an empty roundabout — slowing and looking, but not stopping. */
export const ROUNDABOUT_BASE_DELAY = 3;

/** Extra delay at a roundabout as it approaches capacity. */
export const ROUNDABOUT_QUEUE_DELAY = 30;

/**
 * Travel time on a link at a given load.
 *
 * Rises with the fourth power of the volume/capacity ratio, so a road runs at
 * close to free-flow until it is nearly full and then degrades sharply — which
 * is what makes an equilibrium worth solving for.
 */
export function bprTime(freeFlowTime: number, volume: number, capacity: number): number {
  if (capacity <= 0) return Infinity;
  return freeFlowTime * (1 + BPR_ALPHA * (volume / capacity) ** BPR_BETA);
}

/**
 * Average delay to a vehicle crossing a signalised junction.
 *
 * Webster's uniform delay term: you wait through the red regardless of how
 * empty the road is, and longer as the approach saturates.
 */
export function signalDelay(saturation: number): number {
  const green = SIGNAL_GREEN_SHARE;
  const x = Math.min(Math.max(saturation, 0), 0.95);
  return (SIGNAL_CYCLE * (1 - green) ** 2) / (2 * (1 - green * x));
}

/**
 * Average delay entering a roundabout.
 *
 * Cheaper than signals when quiet — no red to sit at — but worse when busy,
 * because entry depends on gaps in the circulating flow. That trade-off is the
 * actual engineering choice between the two.
 */
export function roundaboutDelay(saturation: number): number {
  const x = Math.min(Math.max(saturation, 0), 0.98);
  return ROUNDABOUT_BASE_DELAY + ROUNDABOUT_QUEUE_DELAY * x ** 4;
}

/**
 * Delay and capacity a crossing imposes on one of the roads through it.
 *
 * Grade separation is the point of a bridge or underpass: the two roads never
 * conflict, so neither waits and neither loses capacity. Everything else has to
 * share the junction in time.
 */
export function crossingEffect(
  style: CrossingStyle,
  lanes: number
): { capacity: number; delayAt: (saturation: number) => number } {
  switch (style) {
    case 'bridge':
    case 'underpass':
      return { capacity: Infinity, delayAt: () => 0 };
    case 'roundabout':
      return {
        capacity: ROUNDABOUT_ENTRY_CAPACITY,
        delayAt: roundaboutDelay
      };
    case 'signals':
    default:
      return {
        capacity: SATURATION_FLOW_PER_LANE * lanes * SIGNAL_GREEN_SHARE,
        delayAt: signalDelay
      };
  }
}

/** One direction of one road. */
export interface Link {
  id: string;
  roadId: string;
  reversed: boolean;
  from: string;
  to: string;
  length: number;
  /** Seconds at free-flow speed, before any junction delay. */
  freeFlowTime: number;
  /** Vehicles per hour, after any junction restriction. */
  capacity: number;
  /** Crossings on this road that cost it time. */
  delays: ((saturation: number) => number)[];
}

export function linkId(roadId: string, reversed: boolean): string {
  return `${roadId}:${reversed ? 'r' : 'f'}`;
}

/**
 * Directional links with capacities, including whatever the junctions on them
 * take away.
 *
 * A road is only as good as its worst junction: a dual carriageway metered by a
 * set of signals carries what the signals let through, not what the tarmac
 * could.
 */
export function buildLinks(network: RoadNetwork, weather: Weather = 'clear'): Link[] {
  const links: Link[] = [];
  const conditions = WEATHER_EFFECT[weather] ?? WEATHER_EFFECT.clear;

  for (const entry of network.roads) {
    const type = entry.road.type;
    const lanes = LANES_PER_DIRECTION[type] ?? 1;

    let capacity = SATURATION_FLOW_PER_LANE * lanes;
    if (type === 'residential') capacity *= RESIDENTIAL_CAPACITY_FACTOR;

    const delays: Link['delays'] = [];

    for (const crossing of network.crossings) {
      if (crossing.primaryId !== entry.road.id && crossing.secondaryId !== entry.road.id) {
        continue;
      }
      const effect = crossingEffect(crossing.style, lanes);
      capacity = Math.min(capacity, effect.capacity);
      delays.push(effect.delayAt);
    }

    // Weather is applied after the junction cap: bad weather slows the approach
    // to a set of signals as well as the open road between them.
    capacity *= conditions.capacity;

    const length = pathLength(entry.path);
    if (length <= 0) continue;
    const freeFlowTime = length / (FREE_FLOW_SPEED[type] * conditions.speed);

    /*
      Gradient is per direction: the same hill is a climb one way and a descent
      the other, and only the climb costs speed and capacity. Modelling the two
      directions with one number would average away the asymmetry that makes a
      hillside route bad in one direction and fine in the other.
    */
    const grade = gradeOf(entry.path).overall;

    for (const reversed of [false, true]) {
      const climb = gradeFactors(reversed ? -grade : grade);

      links.push({
        id: linkId(entry.road.id, reversed),
        roadId: entry.road.id,
        reversed,
        from: reversed ? entry.toId : entry.fromId,
        to: reversed ? entry.fromId : entry.toId,
        length,
        freeFlowTime: freeFlowTime / climb.speed,
        capacity: capacity * climb.capacity,
        delays
      });
    }
  }

  return links;
}

/** Travel time on a link carrying `volume` vehicles per hour. */
export function linkTime(link: Link, volume: number): number {
  const saturation = link.capacity > 0 ? volume / link.capacity : 1;
  let time = bprTime(link.freeFlowTime, volume, link.capacity);
  for (const delay of link.delays) time += delay(saturation);
  return time;
}

/** Origin-destination demand, independent of which way anyone drives. */
export interface Demand {
  fromId: string;
  toId: string;
  /** Vehicles per hour. */
  flow: number;
}

interface LinkPath {
  linkIds: string[];
  time: number;
}

/**
 * Quickest paths from one origin at the given link times.
 *
 * Separate from tripModel's version because assignment re-routes against costs
 * that change every iteration, rather than the fixed free-flow times.
 */
function quickestPaths(
  adjacency: Map<string, Link[]>,
  times: Map<string, number>,
  from: string
): Map<string, LinkPath> {
  const best = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, { node: string; link: Link }>();
  const settled = new Set<string>();

  for (;;) {
    let current: string | null = null;
    let currentCost = Infinity;
    for (const [node, cost] of best) {
      if (!settled.has(node) && cost < currentCost) {
        current = node;
        currentCost = cost;
      }
    }
    if (current === null) break;
    settled.add(current);

    for (const link of adjacency.get(current) ?? []) {
      const cost = currentCost + (times.get(link.id) ?? Infinity);
      if (cost < (best.get(link.to) ?? Infinity)) {
        best.set(link.to, cost);
        previous.set(link.to, { node: current, link });
      }
    }
  }

  const paths = new Map<string, LinkPath>();
  for (const [node, time] of best) {
    if (node === from) continue;

    const linkIds: string[] = [];
    let at = node;
    while (at !== from) {
      const step = previous.get(at);
      if (!step) break;
      linkIds.unshift(step.link.id);
      at = step.node;
    }
    if (linkIds.length > 0) paths.set(node, { linkIds, time });
  }

  return paths;
}

/** Load every trip onto its quickest path at the current times. */
function allOrNothing(
  adjacency: Map<string, Link[]>,
  times: Map<string, number>,
  demand: Demand[]
): { volumes: Map<string, number>; paths: Map<string, LinkPath> } {
  const volumes = new Map<string, number>();
  const paths = new Map<string, LinkPath>();

  const byOrigin = new Map<string, Demand[]>();
  for (const d of demand) {
    const list = byOrigin.get(d.fromId);
    if (list) list.push(d);
    else byOrigin.set(d.fromId, [d]);
  }

  for (const [origin, movements] of byOrigin) {
    const trees = quickestPaths(adjacency, times, origin);
    for (const movement of movements) {
      const path = trees.get(movement.toId);
      if (!path) continue;
      paths.set(`${movement.fromId}>${movement.toId}`, path);
      for (const id of path.linkIds) {
        volumes.set(id, (volumes.get(id) ?? 0) + movement.flow);
      }
    }
  }

  return { volumes, paths };
}

export interface LinkFlow {
  linkId: string;
  roadId: string;
  reversed: boolean;
  from: string;
  to: string;
  /** Vehicles per hour at equilibrium. */
  volume: number;
  capacity: number;
  /** volume / capacity. Above 1 the road is over capacity. */
  saturation: number;
  /** Seconds to drive it at that load. */
  time: number;
  /** Seconds it would take with the road to yourself. */
  freeFlowTime: number;
  /** Seconds lost to congestion and junctions. */
  delay: number;
}

export interface Assignment {
  links: LinkFlow[];
  /** Representative route per movement at equilibrium. */
  trips: Trip[];
  /**
   * How far from a true equilibrium, as a fraction. Below ~1e-4 the answer is
   * converged; a large value means the iteration limit was hit first.
   */
  relativeGap: number;
  iterations: number;
  /** Total vehicle-hours spent travelling. The thing a scheme should reduce. */
  totalTravelTime: number;
}

export const MAX_ITERATIONS = 40;
export const CONVERGENCE_GAP = 1e-4;

/**
 * Solve for user equilibrium with Frank-Wolfe.
 *
 * Each pass loads everyone onto the quickest paths at the current times, then
 * moves the existing flows part of the way towards that new pattern — the step
 * chosen by bisection on the Beckmann objective, which converges far faster
 * than the usual 1/k averaging.
 */
export function assignTraffic(
  network: RoadNetwork,
  demand: Demand[],
  options: { maxIterations?: number; tolerance?: number; weather?: Weather } = {}
): Assignment {
  const maxIterations = options.maxIterations ?? MAX_ITERATIONS;
  const tolerance = options.tolerance ?? CONVERGENCE_GAP;

  const links = buildLinks(network, options.weather ?? 'clear');
  const byId = new Map(links.map(l => [l.id, l]));

  const adjacency = new Map<string, Link[]>();
  for (const link of links) {
    const list = adjacency.get(link.from);
    if (list) list.push(link);
    else adjacency.set(link.from, [link]);
  }

  const timesAt = (volumes: Map<string, number>) => {
    const times = new Map<string, number>();
    for (const link of links) times.set(link.id, linkTime(link, volumes.get(link.id) ?? 0));
    return times;
  };

  // Start from an empty network: everyone on their free-flow quickest path.
  let volumes = allOrNothing(adjacency, timesAt(new Map()), demand).volumes;

  let relativeGap = Infinity;
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;

    const times = timesAt(volumes);
    const target = allOrNothing(adjacency, times, demand).volumes;

    /*
      Relative gap: how much travel time everyone would save by all switching to
      the current quickest paths. At equilibrium nobody can improve, so it is
      zero.
    */
    let current = 0;
    let ideal = 0;
    for (const link of links) {
      const t = times.get(link.id)!;
      current += t * (volumes.get(link.id) ?? 0);
      ideal += t * (target.get(link.id) ?? 0);
    }
    relativeGap = current > 0 ? (current - ideal) / current : 0;
    if (relativeGap <= tolerance) break;

    // Directional derivative of the Beckmann objective at step size `step`.
    const slopeAt = (step: number) => {
      let slope = 0;
      for (const link of links) {
        const x = volumes.get(link.id) ?? 0;
        const y = target.get(link.id) ?? 0;
        const direction = y - x;
        if (direction === 0) continue;
        slope += linkTime(link, x + step * direction) * direction;
      }
      return slope;
    };

    let step = 1;
    if (slopeAt(1) > 0) {
      let low = 0;
      let high = 1;
      for (let bisect = 0; bisect < 24; bisect++) {
        const mid = (low + high) / 2;
        if (slopeAt(mid) > 0) high = mid;
        else low = mid;
      }
      step = (low + high) / 2;
    }

    const moved = new Map<string, number>();
    for (const link of links) {
      const x = volumes.get(link.id) ?? 0;
      const y = target.get(link.id) ?? 0;
      moved.set(link.id, x + step * (y - x));
    }
    volumes = moved;
  }

  // Representative routes at the converged times, for anything that needs to
  // draw a journey. Frank-Wolfe converges on link flows, not on a single route
  // per movement, so this is a reasonable stand-in rather than the real split.
  const finalTimes = timesAt(volumes);
  const { paths } = allOrNothing(adjacency, finalTimes, demand);

  const trips: Trip[] = [];
  for (const movement of demand) {
    const path = paths.get(`${movement.fromId}>${movement.toId}`);
    if (!path) continue;

    let length = 0;
    const legs = path.linkIds.map(id => {
      const link = byId.get(id)!;
      length += link.length;
      return { roadId: link.roadId, reversed: link.reversed };
    });

    const nodes = [movement.fromId];
    for (const id of path.linkIds) nodes.push(byId.get(id)!.to);

    trips.push({
      fromId: movement.fromId,
      toId: movement.toId,
      route: { legs, nodes, length, time: path.time },
      flow: movement.flow
    });
  }

  const flows: LinkFlow[] = links.map(link => {
    const volume = volumes.get(link.id) ?? 0;
    const time = finalTimes.get(link.id)!;
    return {
      linkId: link.id,
      roadId: link.roadId,
      reversed: link.reversed,
      from: link.from,
      to: link.to,
      volume,
      capacity: link.capacity,
      saturation: link.capacity > 0 ? volume / link.capacity : 0,
      time,
      freeFlowTime: link.freeFlowTime,
      delay: time - link.freeFlowTime
    };
  });

  const totalTravelTime = flows.reduce((sum, f) => sum + (f.volume * f.time) / 3600, 0);

  return { links: flows, trips, relativeGap, iterations, totalTravelTime };
}

/**
 * Demand for a given hour, from the same gravity model the trip layer uses.
 *
 * Distribution is done once at free-flow rather than re-derived as congestion
 * builds. A combined distribution-assignment model would feed the congested
 * times back into the choice of destination; that mostly matters when
 * congestion is severe enough to change where people go, not just how they
 * get there.
 */
export function demandForHour(
  network: RoadNetwork,
  locations: Location[],
  hour: number,
  occupantsPerVehicle: number,
  rate = 1
): Demand[] {
  const graph = buildTripGraph(network);
  const trips = buildTrips(graph, tripEnds(locations, hour), occupantsPerVehicle);
  return trips.map(t => ({
    fromId: t.fromId,
    toId: t.toId,
    flow: t.flow * Math.max(0, rate)
  }));
}

/**
 * Convenience: demand and equilibrium in one call.
 *
 * @param rate scenario multiplier on demand. The same control that thins the
 *   traffic on screen also drives the model, so turning it up is a real
 *   stress test — "what does this network do if the city grows by half" — and
 *   not just a density knob. Without it the shipped layouts never approach
 *   capacity and every junction choice looks equally good.
 */
export function assignCity(
  network: RoadNetwork,
  locations: Location[],
  hour: number,
  occupantsPerVehicle: number,
  rate = 1,
  weather: Weather = 'clear'
): Assignment {
  return assignTraffic(
    network,
    demandForHour(network, locations, hour, occupantsPerVehicle, rate),
    { weather }
  );
}

/**
 * Colour for a link at a given volume/capacity ratio.
 *
 * The standard congestion banding a traffic study is presented in: free below
 * about half capacity, degrading through amber, red once demand exceeds what
 * the road can carry. Deliberately banded rather than a smooth gradient — the
 * thresholds are the point, and a continuous ramp invites reading precision
 * into a model that does not have it.
 */
export function congestionColour(saturation: number): string {
  if (saturation >= 1) return '#b91c1c';   // over capacity
  if (saturation >= 0.85) return '#ea580c'; // at capacity
  if (saturation >= 0.7) return '#f59e0b';  // busy
  if (saturation >= 0.5) return '#facc15';  // approaching
  if (saturation > 0) return '#22c55e';     // free flowing
  return '#94a3b8';                          // unused
}

export const CONGESTION_BANDS = [
  { from: 0.0, label: 'Free flowing', colour: '#22c55e' },
  { from: 0.5, label: 'Approaching', colour: '#facc15' },
  { from: 0.7, label: 'Busy', colour: '#f59e0b' },
  { from: 0.85, label: 'At capacity', colour: '#ea580c' },
  { from: 1.0, label: 'Over capacity', colour: '#b91c1c' }
] as const;

/**
 * Worst direction of each road, keyed by road id — what a congestion overlay
 * should show, since a road is a problem if either direction is.
 */
export function worstSaturationByRoad(assignment: Assignment): Map<string, number> {
  const worst = new Map<string, number>();
  for (const link of assignment.links) {
    worst.set(link.roadId, Math.max(worst.get(link.roadId) ?? 0, link.saturation));
  }
  return worst;
}

/**
 * What each junction style would cost at this crossing, so the choice can be
 * made on numbers rather than on the look of it.
 */
export function compareCrossingStyles(
  crossing: Crossing,
  assignment: Assignment,
  roadType: string
): { style: CrossingStyle; capacity: number; delay: number; saturation: number }[] {
  const lanes = LANES_PER_DIRECTION[roadType] ?? 1;

  // Busiest direction through this crossing sets the delay each style implies.
  const through = assignment.links.filter(
    l => l.roadId === crossing.primaryId || l.roadId === crossing.secondaryId
  );
  const volume = through.reduce((most, l) => Math.max(most, l.volume), 0);

  return (['signals', 'roundabout', 'bridge', 'underpass'] as CrossingStyle[]).map(style => {
    const effect = crossingEffect(style, lanes);
    const capacity = effect.capacity;
    const saturation = Number.isFinite(capacity) ? volume / capacity : 0;
    return { style, capacity, delay: effect.delayAt(saturation), saturation };
  });
}
