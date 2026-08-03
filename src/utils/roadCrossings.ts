import * as THREE from 'three';
import { Location, Road } from '../types/city';
import { ROAD_WIDTH, ROAD_SURFACE_Y } from './scale';
import { elevationAt } from './terrain';
import { distanceToNearestBuilding } from './buildingCollision';

/**
 * Intersections.
 *
 * An intersection is a place where two road centre-lines actually cross
 * mid-span. It is *not* a building where several roads terminate: roads in this
 * model connect buildings, so treating those as junctions put roundabouts and
 * signal poles inside the buildings themselves.
 *
 * How each intersection is resolved is the user's choice — see CrossingStyle.
 */

/** Clear height under a bridge deck — enough for a double-decker bus. */
export const BRIDGE_CLEARANCE = 5.5;

/**
 * Distance either side of the crossing used to ramp up and back down.
 *
 * 5.5 m of clearance over this distance is a gradient of about 6%, which is the
 * practical limit for an urban road that buses and lorries have to climb. It was
 * 45 m, i.e. 12% average and steeper still at the midpoint of the smoothstep —
 * buildable as geometry, not as a road.
 */
export const BRIDGE_RAMP = 92;

export type CrossingStyle = 'signals' | 'roundabout' | 'bridge' | 'underpass';

export const CROSSING_STYLES: { id: CrossingStyle; label: string; description: string }[] = [
  { id: 'signals', label: 'Signals', description: 'At-grade crossing with traffic lights' },
  { id: 'roundabout', label: 'Roundabout', description: 'At-grade circulating island' },
  { id: 'bridge', label: 'Bridge', description: 'Primary road rises over the other' },
  { id: 'underpass', label: 'Underpass', description: 'Primary road passes beneath the other' }
];

export const DEFAULT_CROSSING_STYLE: CrossingStyle = 'signals';

/**
 * Stable identity for an intersection, independent of which order the roads
 * were found in. Used as the key for the user's saved choice.
 */
export function crossingKey(a: string, b: string): string {
  return [a, b].sort().join('~');
}

export interface Crossing {
  key: string;
  /**
   * The road the style is expressed relative to — deterministically the one
   * with the lower id, so "bridge" always means the same thing for a given
   * pair no matter what order they were processed in.
   */
  primaryId: string;
  secondaryId: string;
  style: CrossingStyle;
  /** Road that ends up above, or null when both stay at grade. */
  overId: string | null;
  /** Road that ends up below, or null when both stay at grade. */
  underId: string | null;
  /** Where they cross, in world space (x, z). */
  point: THREE.Vector2;
  /** Deck height for the road going over. */
  deckY: number;
  /** Width of whichever road carries the deck, for sizing the structure. */
  width: number;
  /** Widest of the two roads, for sizing at-grade junction furniture. */
  junctionWidth: number;
  /** Outer radius a roundabout may occupy here without hitting a building. */
  roundaboutOuter: number;
  /**
   * False when there isn't room for a usable roundabout. The style falls back
   * to signals, and the UI offers the reason rather than silently ignoring the
   * choice.
   */
  roundaboutFits: boolean;
}

/** Gap kept between the outer kerb of a roundabout and any building. */
export const ROUNDABOUT_BUILDING_GAP = 3;

/**
 * Smallest usable roundabout, as a multiple of the widest road meeting there.
 *
 * Below this the circulating carriageway is too narrow for a bus to track
 * around the island, so a roundabout simply isn't buildable at that spot.
 */
const MIN_ROUNDABOUT_SCALE = 1.0;
const NATURAL_ROUNDABOUT_SCALE = 1.5;

/**
 * Roundabout geometry, shared by the renderer and the path deformation so the
 * tarmac and the driving line describe the same circle.
 *
 * Uses the fitted radius worked out against nearby buildings, not the natural
 * size — otherwise a junction close to a building is drawn straight through it.
 */
export function roundaboutRadii(crossing: Crossing) {
  const outer = crossing.roundaboutOuter;
  const island = outer * 0.45;
  return {
    outer,
    island,
    /** Centre-line of the circulating carriageway. */
    lane: (outer + island) / 2
  };
}

export interface RoundaboutFit {
  /** Outer radius that clears every building, at most the natural size. */
  outer: number;
  /** False when even the smallest usable roundabout would hit a building. */
  fits: boolean;
}

/**
 * How large a roundabout can be here, given what is built nearby.
 *
 * Shrinks toward the minimum before giving up, so a slightly tight junction
 * still gets a (smaller) roundabout rather than being refused outright.
 *
 * @param clearance distance from the crossing point to the nearest building
 */
export function fitRoundabout(junctionWidth: number, clearance: number): RoundaboutFit {
  const natural = junctionWidth * NATURAL_ROUNDABOUT_SCALE;
  const minimum = junctionWidth * MIN_ROUNDABOUT_SCALE;
  const available = clearance - ROUNDABOUT_BUILDING_GAP;

  if (available >= natural) return { outer: natural, fits: true };
  if (available >= minimum) return { outer: available, fits: true };
  return { outer: minimum, fits: false };
}

/**
 * Direction of travel around a roundabout, seen from above.
 *
 * Clockwise matches left-hand traffic, which is what the default map centre
 * (Pune) uses. Flip the sign for right-hand-traffic countries.
 */
const ROUNDABOUT_CLOCKWISE = true;

/**
 * Bend a road's centre-line around any roundabout it passes through.
 *
 * Without this both roads at a roundabout run straight through the middle — so
 * traffic drove over the island rather than around it. The section inside the
 * junction is replaced with an arc along the circulating carriageway.
 */
export function routeAroundRoundabouts(
  path: THREE.Vector3[],
  crossings: Crossing[]
): THREE.Vector3[] {
  const roundabouts = crossings.filter(c => c.style === 'roundabout');
  if (roundabouts.length === 0) return path;

  let result = path;

  for (const crossing of roundabouts) {
    const { lane } = roundaboutRadii(crossing);
    const centre = crossing.point;

    const distance = (p: THREE.Vector3) => Math.hypot(p.x - centre.x, p.z - centre.y);
    const inside = result.map(p => distance(p) < lane);

    const firstInside = inside.indexOf(true);
    const lastInside = inside.lastIndexOf(true);

    // Never reaches the junction at all.
    if (firstInside === -1) continue;

    // Entirely swallowed by it — no approach to arc between.
    if (firstInside === 0 && lastInside === result.length - 1) continue;

    /*
      A road can begin or end inside the junction, when a roundabout lands close
      to the building a road terminates at. Clamp to the road's own end rather
      than skipping: bailing out here left that road running straight over the
      island while the other one circulated correctly around it.
    */
    const entry = result[Math.max(0, firstInside - 1)];
    const exit = result[Math.min(result.length - 1, lastInside + 1)];

    const angleOf = (p: THREE.Vector3) => Math.atan2(p.z - centre.y, p.x - centre.x);
    const startAngle = angleOf(entry);
    let endAngle = angleOf(exit);

    // Walk consistently in the traffic direction, which may mean going the
    // long way round rather than taking the shorter sweep.
    const sweepSign = ROUNDABOUT_CLOCKWISE ? -1 : 1;
    while (sweepSign * (endAngle - startAngle) <= 0) {
      endAngle += sweepSign * Math.PI * 2;
    }

    const steps = Math.max(6, Math.ceil(Math.abs(endAngle - startAngle) / 0.2));
    const arc: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + ((endAngle - startAngle) * i) / steps;
      const x = centre.x + Math.cos(angle) * lane;
      const z = centre.y + Math.sin(angle) * lane;
      // Take the height from the ground, not from the approach: copying the
      // entry point's level left the circulating carriageway as a flat disc
      // hovering over sloping terrain.
      arc.push(new THREE.Vector3(x, elevationAt(x, z) + ROAD_SURFACE_Y, z));
    }

    result = [
      ...result.slice(0, firstInside),
      ...arc,
      ...result.slice(lastInside + 1)
    ];
  }

  return result;
}

/**
 * Intersection of segments p1->p2 and p3->p4, or null if they don't cross
 * within both spans.
 */
function segmentIntersection(
  p1: THREE.Vector2, p2: THREE.Vector2,
  p3: THREE.Vector2, p4: THREE.Vector2
): THREE.Vector2 | null {
  const d1 = new THREE.Vector2().subVectors(p2, p1);
  const d2 = new THREE.Vector2().subVectors(p4, p3);

  const denominator = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denominator) < 1e-9) return null; // parallel or degenerate

  const diff = new THREE.Vector2().subVectors(p3, p1);
  const t = (diff.x * d2.y - diff.y * d2.x) / denominator;
  const u = (diff.x * d1.y - diff.y * d1.x) / denominator;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return new THREE.Vector2().addVectors(p1, d1.multiplyScalar(t));
}

export interface RoutedRoad {
  road: Road;
  /** Centre-line, already routed around buildings. */
  path: THREE.Vector3[];
  fromId: string;
  toId: string;
}

/**
 * Find every place two roads cross mid-span.
 *
 * @param styles the user's saved choice per crossing key; anything absent
 *               falls back to DEFAULT_CROSSING_STYLE
 */
export function findCrossings(
  roads: RoutedRoad[],
  styles: Record<string, CrossingStyle> = {},
  buildings: Location[] = []
): Crossing[] {
  const crossings: Crossing[] = [];

  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      const a = roads[i];
      const b = roads[j];

      // Sharing an endpoint means they terminate at the same building, not
      // that they cross.
      const shared =
        a.fromId === b.fromId || a.fromId === b.toId ||
        a.toId === b.fromId || a.toId === b.toId;
      if (shared) continue;

      let hit: THREE.Vector2 | null = null;

      outer:
      for (let s = 0; s < a.path.length - 1; s++) {
        const a1 = new THREE.Vector2(a.path[s].x, a.path[s].z);
        const a2 = new THREE.Vector2(a.path[s + 1].x, a.path[s + 1].z);

        for (let t = 0; t < b.path.length - 1; t++) {
          const b1 = new THREE.Vector2(b.path[t].x, b.path[t].z);
          const b2 = new THREE.Vector2(b.path[t + 1].x, b.path[t + 1].z);

          const point = segmentIntersection(a1, a2, b1, b2);
          if (point) { hit = point; break outer; }
        }
      }

      if (!hit) continue;

      // Primary is the lower id, so the meaning of "bridge" is stable.
      const primary = a.road.id < b.road.id ? a : b;
      const secondary = primary === a ? b : a;

      const key = crossingKey(a.road.id, b.road.id);
      const requested = styles[key] ?? DEFAULT_CROSSING_STYLE;

      const junctionWidth = Math.max(
        ROAD_WIDTH[primary.road.type],
        ROAD_WIDTH[secondary.road.type]
      );

      // A roundabout has to physically fit between the buildings around it.
      const fit = fitRoundabout(
        junctionWidth,
        distanceToNearestBuilding(hit.x, hit.y, buildings)
      );

      // Fall back to signals rather than drawing an island through a building.
      const style: CrossingStyle =
        requested === 'roundabout' && !fit.fits ? 'signals' : requested;

      const overId =
        style === 'bridge' ? primary.road.id
          : style === 'underpass' ? secondary.road.id
            : null;
      const underId =
        style === 'bridge' ? secondary.road.id
          : style === 'underpass' ? primary.road.id
            : null;

      const carrier = overId === primary.road.id ? primary : secondary;

      crossings.push({
        key,
        primaryId: primary.road.id,
        secondaryId: secondary.road.id,
        style,
        overId,
        underId,
        point: hit,
        // Measured from the ground at the crossing, not from sea level.
        deckY: elevationAt(hit.x, hit.y) + ROAD_SURFACE_Y + BRIDGE_CLEARANCE,
        width: ROAD_WIDTH[carrier.road.type],
        junctionWidth,
        roundaboutOuter: fit.outer,
        roundaboutFits: fit.fits
      });
    }
  }

  return crossings;
}

/**
 * Raise a road's centre-line over the crossings it bridges.
 *
 * Each point takes the maximum height of the ramps it falls inside, so a road
 * crossing two others in quick succession stays up rather than dipping between
 * them. Roads that stay at grade are returned untouched.
 */
export function elevatePath(
  path: THREE.Vector3[],
  crossings: Crossing[]
): THREE.Vector3[] {
  if (crossings.length === 0) return path;

  return path.map(p => {
    /*
      The ramp is added to whatever height the road is already at, rather than
      replacing it. It used to set an absolute height measured from a flat
      world, which was fine while the ground was a plane — on real terrain it
      dragged every bridged road down to sea level and left it buried in the
      hillside either side of the span.
    */
    let rise = 0;

    for (const crossing of crossings) {
      const distance = Math.hypot(p.x - crossing.point.x, p.z - crossing.point.y);
      if (distance >= BRIDGE_RAMP) continue;

      // Smoothstep ramp: flat at the ends, flat on the deck, no kink at either.
      const t = 1 - distance / BRIDGE_RAMP;
      const eased = t * t * (3 - 2 * t);
      rise = Math.max(rise, BRIDGE_CLEARANCE * eased);
    }

    return new THREE.Vector3(p.x, p.y + rise, p.z);
  });
}
