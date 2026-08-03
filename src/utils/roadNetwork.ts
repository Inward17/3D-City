import * as THREE from 'three';
import { Location, Road } from '../types/city';
import { routeRoad } from './roadRouting';
import {
  findCrossings, elevatePath, routeAroundRoundabouts, roundaboutRadii,
  Crossing, RoutedRoad, CrossingStyle
} from './roadCrossings';
import { ROAD_SURFACE_Y, ROAD_WIDTH, PAVEMENT_WIDTH } from './scale';
import { elevationAt } from './terrain';
import { KeepOut, maxDimensionsFor } from './buildingCollision';
import { DESIGN_LIMITS, getEffectiveDimensions } from './buildingDimensions';

/**
 * The finished road network: every centre-line routed around buildings and
 * raised over any crossing it bridges.
 *
 * This exists so the road ribbons and the vehicle paths are built from the same
 * source. They were computed independently once before, and the two drifted —
 * the ribbons meandered while the cars drove dead straight, so traffic ran
 * beside its own roads. Anything that needs a driving line should call this.
 */
export interface NetworkRoad extends RoutedRoad {
  /** Crossings where this road is the one going over. */
  bridges: Crossing[];
}

export interface RoadNetwork {
  roads: NetworkRoad[];
  crossings: Crossing[];
}

/**
 * Insert intermediate points so no segment is longer than `maxSegment`.
 * Needed before elevating a road: a bridge ramp can only be expressed if there
 * are vertices along it to raise.
 */
/**
 * Spacing at which a road samples the ground.
 *
 * A straight road is two points, so without this it would be a straight line in
 * three dimensions — cutting through every rise between its ends rather than
 * going over them.
 */
export const TERRAIN_SAMPLE = 8;

export function densify(path: THREE.Vector3[], maxSegment = 6): THREE.Vector3[] {
  if (path.length < 2) return path;

  const out: THREE.Vector3[] = [path[0]];

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const steps = Math.max(1, Math.ceil(from.distanceTo(to) / maxSegment));

    for (let s = 1; s <= steps; s++) {
      out.push(new THREE.Vector3().lerpVectors(from, to, s / steps));
    }
  }

  return out;
}

/**
 * @param crossingStyles how each crossing is resolved. Deliberately **not**
 *   optional: when it defaulted to `{}`, a caller that forgot it silently got
 *   an all-at-grade network. That is exactly how the vehicle layer ended up
 *   driving cars under a bridge deck the road layer had raised. Prefer the
 *   `useRoadNetwork` hook, which supplies this from the store.
 */
export function buildRoadNetwork(
  locations: Location[],
  roads: Road[],
  crossingStyles: Record<string, CrossingStyle>
): RoadNetwork {
  const byId = new Map(locations.map(l => [l.id, l]));
  const base: RoutedRoad[] = [];

  for (const road of roads) {
    const from = byId.get(road.from);
    const to = byId.get(road.to);
    if (!from || !to) continue;

    const routed = routeRoad(from, to, road.type, { obstacles: locations });
    if (routed.length < 2) continue;

    /*
      routeRoad works purely in plan and returns y = 0. Height is applied here,
      because the ribbon builder takes it from each point — so a road both
      follows the ground and can ramp over a crossing.

      Following the terrain is what gives a road a gradient, and a gradient is
      what makes one route genuinely harder than another of the same length.
    */
    const plan = densify(
      routed.map(p => new THREE.Vector3(p.x, 0, p.z)), TERRAIN_SAMPLE
    );
    const path = plan.map(p => new THREE.Vector3(
      p.x, elevationAt(p.x, p.z) + ROAD_SURFACE_Y, p.z
    ));

    base.push({ road, path, fromId: from.id, toId: to.id });
  }

  // Buildings are passed in so a roundabout can be sized to fit the space
  // available, or refused where there is none.
  const crossings = findCrossings(base, crossingStyles, locations);

  const withBridges: NetworkRoad[] = base.map(entry => {
    // Only the road that goes *over* gets lifted; the one underneath and both
    // roads at an at-grade crossing stay on the ground.
    const bridges = crossings.filter(c => c.overId === entry.road.id);

    // Both roads circulate at a roundabout, so match on either endpoint.
    const roundabouts = crossings.filter(
      c => c.style === 'roundabout' &&
        (c.primaryId === entry.road.id || c.secondaryId === entry.road.id)
    );

    let path = entry.path;

    /*
      Bend in plan first: straight through the middle of a roundabout means
      driving over the island. Then lift, so a bridge ramps above whatever
      level the bend left the road at.

      Both steps need vertices to work with — a two-point road has nothing
      inside the junction to replace and no way to express a ramp — but the
      terrain sampling above has already provided them, so neither densifies
      again here. Doing so would lerp between ground samples and lift the road
      a few millimetres clear of the surface it is supposed to be lying on.
    */
    if (roundabouts.length > 0) {
      path = routeAroundRoundabouts(path, roundabouts);
    }

    if (bridges.length > 0) {
      path = elevatePath(path, bridges);
    }

    return { ...entry, bridges, path };
  });

  return { roads: withBridges, crossings };
}

/**
 * Ground a building must leave clear: the carriageway plus a pavement's width
 * either side.
 *
 * Roads curve around buildings, so the corridor is sampled along the routed
 * centre-line rather than assumed straight. Each sample is a circle covering
 * the carriageway and its pavement, spaced half a width apart so consecutive
 * circles overlap and the corridor has no gaps for a footprint to slip through.
 *
 * @param forLocationId the building being sized. Roads that terminate at it are
 *   skipped — a building is not blocked by its own access road, which by
 *   construction runs to its centre. Those roads stop constraining it entirely,
 *   including at their far end; harmless, since that end is a street away.
 */
export function roadKeepOuts(
  network: RoadNetwork,
  forLocationId?: string
): KeepOut[] {
  const out: KeepOut[] = [];

  for (const entry of network.roads) {
    if (entry.fromId === forLocationId || entry.toId === forLocationId) continue;

    const half = ROAD_WIDTH[entry.road.type] / 2;
    for (const p of densify(entry.path, half)) {
      out.push({ x: p.x, z: p.z, radius: half + PAVEMENT_WIDTH });
    }
  }

  for (const crossing of network.crossings) {
    if (crossing.style !== 'roundabout') continue;
    out.push({
      x: crossing.point.x,
      z: crossing.point.y,
      radius: roundaboutRadii(crossing).outer + PAVEMENT_WIDTH
    });
  }

  return out;
}

/**
 * How big this building could actually be built, letting the roads move.
 *
 * `maxDimensionsFor` answers a narrower question: given where the roads run
 * *right now*, how far can this footprint grow? That is the wrong question for
 * a slider, because roads bend around buildings — so the road is close because
 * the building is small, and the building can't grow because the road is close.
 * The cap tracked the current size about a metre above it, which read as a
 * fixed per-building limit. Past the point where the roads had bent as far as
 * they could, the same one-step answer collapsed instead: an oversized building
 * reported a maximum of 8 m while its slider still showed room.
 *
 * So: search for the largest value that survives its own consequences — set the
 * size, re-route every road around it, and ask whether the result is still
 * legal. The axes are solved one at a time, each against the other's current
 * value, matching how the editor is used.
 *
 * Binary search assumes bigger is never easier to fit. Road re-routing makes
 * that not quite guaranteed in theory; in practice the search agrees with a
 * linear scan (see the tests).
 */
export function maxBuildableSize(
  location: Location,
  locations: Location[],
  roads: Road[],
  crossingStyles: Record<string, CrossingStyle>
): { width: number; depth: number } {
  const current = getEffectiveDimensions(location);

  const solve = (axis: 'width' | 'depth', otherValue: number): number => {
    const other = axis === 'width' ? 'depth' : 'width';
    const { min, max } = DESIGN_LIMITS[axis];

    const fits = (value: number): boolean => {
      const trial = locations.map(l =>
        l.id === location.id
          ? { ...l, design: { ...l.design, [axis]: value, [other]: otherValue } }
          : l
      );
      const me = trial.find(l => l.id === location.id);
      if (!me) return false;

      const network = buildRoadNetwork(trial, roads, crossingStyles);
      const room = maxDimensionsFor(me, trial, roadKeepOuts(network, location.id));
      return room[axis] >= value;
    };

    // Almost every building in an uncrowded city clears the cap outright; check
    // that first so the common case costs one routing pass, not eight.
    if (fits(max)) return max;

    let lo: number = min;
    let hi: number = max;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  /*
    Never report a ceiling below the building's own size. A design saved before
    these limits existed can sit above them, and a slider whose maximum is under
    its handle can't be dragged anywhere — which is how an oversized building
    came to advertise a maximum of 8 m. It can still be shrunk, and the panel
    flags it as constrained; it just isn't described as impossible.
  */
  return {
    width: Math.max(Math.round(current.width), solve('width', current.depth)),
    depth: Math.max(Math.round(current.depth), solve('depth', current.width))
  };
}

/** Driving line for a road, as a curve vehicles can sample. */
export function drivingCurve(road: NetworkRoad): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(road.path);
}
