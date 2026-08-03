import * as THREE from 'three';
import { Location } from '../types/city';
import { RoadNetwork, NetworkRoad } from './roadNetwork';
import { buildingCapacity, occupancyFactor } from './cityMetrics';
import { FREE_FLOW_SPEED } from './scale';

/**
 * Trips.
 *
 * Vehicles used to pick a road at random, slide along it, then teleport to
 * another unrelated road. Nothing about that was a journey: there was no
 * origin, no destination, and no reason for any vehicle to be where it was.
 * A building's position could not affect traffic, because traffic was spread
 * uniformly over every road no matter what stood where.
 *
 * Here a trip is a real origin-destination pair routed over the road graph, so
 * moving a building changes which roads carry its traffic.
 *
 * Deliberately still missing: vehicles do not interact. There is no queueing,
 * no link capacity and no congestion, so every route is the free-flow shortest
 * path and stays that way however many vehicles use it. That is the next layer
 * (equilibrium assignment), and it is what would make the junction styles
 * affect travel time.
 */

/** Distance at which a destination is about half as attractive as an adjacent one. */
export const DETERRENCE_HALF_DISTANCE = 300;

/**
 * Share of a building's occupants that come and go in an average hour, over and
 * above the net change predicted by the occupancy curve.
 *
 * Without this a city at 03:00 — when no curve is moving — would generate no
 * trips at all and the roads would be empty. Real cities never fully stop.
 */
export const BACKGROUND_CHURN = 0.06;

export interface TripEnd {
  id: string;
  /** Departures generated here this hour. */
  production: number;
  /** Arrivals drawn here this hour. */
  attraction: number;
}

export interface GraphEdge {
  to: string;
  roadId: string;
  /** True when the route traverses this road against its stored direction. */
  reversed: boolean;
  /** Real length of the routed centre-line, in metres. */
  length: number;
  /** Seconds to drive it at free-flow speed. */
  time: number;
}

export type TripGraph = Map<string, GraphEdge[]>;

/**
 * Adjacency over the *routed* network, so edge lengths are the distance actually
 * driven — including the detour around a building and the climb over a bridge —
 * rather than the straight line between two centres.
 */
export function buildTripGraph(network: RoadNetwork): TripGraph {
  const graph: TripGraph = new Map();

  const add = (from: string, edge: GraphEdge) => {
    const list = graph.get(from);
    if (list) list.push(edge);
    else graph.set(from, [edge]);
  };

  for (const entry of network.roads) {
    const length = pathLength(entry.path);
    if (length <= 0) continue;

    const time = length / FREE_FLOW_SPEED[entry.road.type];

    add(entry.fromId, { to: entry.toId, roadId: entry.road.id, reversed: false, length, time });
    add(entry.toId, { to: entry.fromId, roadId: entry.road.id, reversed: true, length, time });
  }

  return graph;
}

export function pathLength(path: THREE.Vector3[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += path[i - 1].distanceTo(path[i]);
  return total;
}

export interface Route {
  /** Roads traversed, in order, with the direction each is driven. */
  legs: { roadId: string; reversed: boolean }[];
  /** Buildings passed through, origin first and destination last. */
  nodes: string[];
  /** Total driving distance, metres. */
  length: number;
  /** Free-flow driving time, seconds. */
  time: number;
}

/**
 * Quickest route between two buildings, or null when they aren't connected.
 *
 * Dijkstra on driving time rather than distance, so a longer run on an arterial
 * beats a shorter crawl through residential streets — which is how drivers
 * actually choose, and it means the road classes matter.
 */
export function shortestRoute(graph: TripGraph, from: string, to: string): Route | null {
  return shortestRoutesFrom(graph, from).get(to) ?? null;
}

/**
 * Every route out of one origin, in a single pass.
 *
 * Building an OD matrix needs one of these per origin rather than one search
 * per pair, which is the difference between O(n · E log V) and O(n² · E log V).
 */
export function shortestRoutesFrom(graph: TripGraph, from: string): Map<string, Route> {
  const best = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, { node: string; edge: GraphEdge }>();
  const settled = new Set<string>();

  // Linear scan for the nearest unsettled node. A binary heap would be faster,
  // but city graphs here are tens of nodes, not thousands.
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

    for (const edge of graph.get(current) ?? []) {
      const cost = currentCost + edge.time;
      if (cost < (best.get(edge.to) ?? Infinity)) {
        best.set(edge.to, cost);
        previous.set(edge.to, { node: current, edge });
      }
    }
  }

  const routes = new Map<string, Route>();

  for (const [node, time] of best) {
    if (node === from) continue;

    const legs: Route['legs'] = [];
    const nodes: string[] = [node];
    let length = 0;
    let at = node;

    while (at !== from) {
      const step = previous.get(at);
      if (!step) break;
      legs.unshift({ roadId: step.edge.roadId, reversed: step.edge.reversed });
      nodes.unshift(step.node);
      length += step.edge.length;
      at = step.node;
    }

    if (legs.length > 0) routes.set(node, { legs, nodes, length, time });
  }

  return routes;
}

/**
 * Departures and arrivals per building for a given hour.
 *
 * Derived from the movement already implied by the occupancy curves rather than
 * from a separate set of invented rates: a building whose occupancy is climbing
 * is drawing arrivals, one whose occupancy is falling is generating departures.
 * That produces the morning and evening flip for free — offices fill while homes
 * empty, and the reverse at six — without labelling anything as home or work.
 */
export function tripEnds(locations: Location[], hour: number): TripEnd[] {
  const previousHour = (Math.floor(hour) + 23) % 24;

  return locations.map(location => {
    const capacity = buildingCapacity(location);
    const now = capacity * occupancyFactor(location.type, Math.floor(hour), location.zone);
    const before = capacity * occupancyFactor(location.type, previousHour, location.zone);

    const change = now - before;
    const churn = now * BACKGROUND_CHURN;

    return {
      id: location.id,
      production: Math.max(0, -change) + churn,
      attraction: Math.max(0, change) + churn
    };
  });
}

export interface Trip {
  fromId: string;
  toId: string;
  route: Route;
  /** Vehicles per hour on this movement. */
  flow: number;
}

/**
 * Origin-destination flows, distributed by a singly-constrained gravity model:
 * a trip leaving i picks its destination in proportion to how much each j is
 * attracting and how easy j is to reach.
 *
 * Singly rather than doubly constrained — every origin sends exactly what it
 * generates, but a destination may receive more or less than its attraction
 * suggests. Balancing both sides needs Furness iteration and buys little while
 * there is no capacity to respect.
 */
export function buildTrips(
  graph: TripGraph,
  ends: TripEnd[],
  occupantsPerVehicle: number
): Trip[] {
  const attractionOf = new Map(ends.map(e => [e.id, e.attraction]));
  const trips: Trip[] = [];

  for (const origin of ends) {
    if (origin.production <= 0) continue;

    const routes = shortestRoutesFrom(graph, origin.id);
    if (routes.size === 0) continue;

    // Deterrence: halves at DETERRENCE_HALF_DISTANCE, so nearby destinations
    // dominate without distant ones dropping out entirely.
    const candidates: { toId: string; route: Route; weight: number }[] = [];
    let totalWeight = 0;

    for (const [toId, route] of routes) {
      const attraction = attractionOf.get(toId) ?? 0;
      if (attraction <= 0) continue;

      const deterrence = 1 / (1 + (route.length / DETERRENCE_HALF_DISTANCE) ** 2);
      const weight = attraction * deterrence;
      if (weight <= 0) continue;

      candidates.push({ toId, route, weight });
      totalWeight += weight;
    }

    if (totalWeight <= 0) continue;

    for (const candidate of candidates) {
      const people = origin.production * (candidate.weight / totalWeight);
      const flow = people / occupantsPerVehicle;
      if (flow <= 0) continue;

      trips.push({ fromId: origin.id, toId: candidate.toId, route: candidate.route, flow });
    }
  }

  return trips;
}

/**
 * A trip as something to drive: one continuous curve from origin to
 * destination, with the length and speed needed to travel it at a real rate.
 */
export interface DrivablePath {
  curve: THREE.CatmullRomCurve3;
  /** Metres, so progress can advance at a speed rather than a fraction. */
  length: number;
  /** Length-weighted free-flow speed over the roads used, m/s. */
  speed: number;
  /** Vehicles per hour choosing this movement; used to sample realistically. */
  flow: number;
  fromId: string;
  toId: string;
}

/**
 * Points curving around an intermediate building, joining one road's end to the
 * next road's start.
 *
 * Roads stop at the building edge, so a route that changes road at a building
 * has a gap the width of that building. Left as a gap the curve interpolates
 * straight across it and vehicles drive through the building — so the two ends
 * are joined by an arc round the outside instead, which is also what a vehicle
 * actually does at a junction.
 */
function arcAround(
  centre: Location,
  from: THREE.Vector3,
  to: THREE.Vector3
): THREE.Vector3[] {
  const cx = centre.position[0];
  const cz = centre.position[2];

  const startAngle = Math.atan2(from.z - cz, from.x - cx);
  const endAngle = Math.atan2(to.z - cz, to.x - cx);

  // Sweep the short way round.
  let sweep = endAngle - startAngle;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  while (sweep < -Math.PI) sweep += Math.PI * 2;

  const radius = Math.max(
    Math.hypot(from.x - cx, from.z - cz),
    Math.hypot(to.x - cx, to.z - cz)
  );

  // One point per ~22 degrees, so even a U-turn stays smooth.
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 8)));
  const points: THREE.Vector3[] = [];

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const angle = startAngle + sweep * t;
    points.push(new THREE.Vector3(
      cx + Math.cos(angle) * radius,
      from.y + (to.y - from.y) * t,
      cz + Math.sin(angle) * radius
    ));
  }

  return points;
}

/**
 * Stitch a trip's roads into a single driving line.
 *
 * Each road's stored path runs from its `from` building to its `to` building,
 * so a leg driven the other way has to be reversed before it is appended —
 * otherwise the vehicle would jump to the far end of every second road.
 */
export function toDrivablePath(
  trip: Trip,
  network: RoadNetwork,
  locations: Location[]
): DrivablePath | null {
  const roadById = new Map<string, NetworkRoad>(network.roads.map(r => [r.road.id, r]));
  const buildingById = new Map(locations.map(l => [l.id, l]));

  const points: THREE.Vector3[] = [];
  let speedDistance = 0;

  trip.route.legs.forEach((leg, index) => {
    const entry = roadById.get(leg.roadId);
    if (!entry) return;

    const legPoints = leg.reversed ? [...entry.path].reverse() : entry.path;

    // Round the building where this leg meets the last one.
    if (points.length > 0) {
      const junction = buildingById.get(trip.route.nodes[index]);
      const previous = points[points.length - 1];
      if (junction) points.push(...arcAround(junction, previous, legPoints[0]));
    }

    points.push(...legPoints);
    speedDistance += pathLength(entry.path) * FREE_FLOW_SPEED[entry.road.type];
  });

  if (points.length < 2) return null;

  const length = pathLength(points);
  if (length <= 0) return null;

  return {
    curve: new THREE.CatmullRomCurve3(points),
    length,
    speed: speedDistance / trip.route.length,
    flow: trip.flow,
    fromId: trip.fromId,
    toId: trip.toId
  };
}

/** Turn routed trips into driving lines, dropping any that cannot be built. */
export function tripsToDrivablePaths(
  trips: Trip[],
  network: RoadNetwork,
  locations: Location[]
): DrivablePath[] {
  const paths: DrivablePath[] = [];
  for (const trip of trips) {
    const path = toDrivablePath(trip, network, locations);
    if (path) paths.push(path);
  }
  return paths;
}

/**
 * Every trip in the city at free-flow, ready to drive.
 *
 * Routes here ignore congestion. Anything that should respond to how busy the
 * roads are wants `assignCity` instead, and to pass its trips through
 * `tripsToDrivablePaths`.
 */
export function buildDrivablePaths(
  network: RoadNetwork,
  locations: Location[],
  hour: number,
  occupantsPerVehicle: number
): DrivablePath[] {
  const graph = buildTripGraph(network);
  const trips = buildTrips(graph, tripEnds(locations, hour), occupantsPerVehicle);
  return tripsToDrivablePaths(trips, network, locations);
}

/**
 * Move a vehicle along its trip by one frame's worth of driving.
 *
 * `progress` is a *fraction* of this particular trip, so the metres covered
 * have to be divided by the trip's own length. Skipping that division is what
 * the old model did: "speed" then meant fraction-per-second, every vehicle
 * crossed every road in the same number of seconds however long it was, and a
 * car on a 350 m road was doing 63 km/h while the same car on a 100 m road
 * crawled at 18.
 *
 * Lives here rather than inline in the render loop so it can be tested without
 * mounting a canvas.
 *
 * @param speedFactor vehicle's multiplier on the road's free-flow speed
 * @param delta seconds since the previous frame
 */
export function advanceAlongTrip(
  progress: number,
  path: Pick<DrivablePath, 'length' | 'speed'>,
  speedFactor: number,
  delta: number
): number {
  if (path.length <= 0) return progress;
  return progress + (path.speed * speedFactor * delta) / path.length;
}

/**
 * The next journey for a vehicle that has just arrived somewhere.
 *
 * Continues from where it stopped rather than reappearing across the city. As
 * well as removing the last teleport, this matters because short hops are real:
 * two buildings 42 m apart have an 12 m road between them, driven in under a
 * second, and a vehicle that jumped elsewhere on finishing it would visibly
 * flicker between unrelated streets several times a second.
 *
 * Falls back to sampling the whole city when nothing departs from here — a
 * dead-end destination that generates no trips of its own.
 *
 * @param roll a value in [0, 1)
 */
export function nextTripFrom(
  paths: DrivablePath[],
  arrivedAt: string,
  roll: number
): number {
  const onward: number[] = [];
  let total = 0;

  for (let i = 0; i < paths.length; i++) {
    if (paths[i].fromId !== arrivedAt) continue;
    onward.push(i);
    total += paths[i].flow;
  }

  if (onward.length === 0 || total <= 0) return sampleByFlow(paths, roll);

  let target = roll * total;
  for (const index of onward) {
    target -= paths[index].flow;
    if (target <= 0) return index;
  }
  return onward[onward.length - 1];
}

/**
 * Pick a trip in proportion to its flow, so busy movements carry more vehicles.
 *
 * @param roll a value in [0, 1)
 */
export function sampleByFlow(paths: DrivablePath[], roll: number): number {
  const total = paths.reduce((sum, p) => sum + p.flow, 0);
  if (total <= 0) return 0;

  let target = roll * total;
  for (let i = 0; i < paths.length; i++) {
    target -= paths[i].flow;
    if (target <= 0) return i;
  }
  return paths.length - 1;
}
