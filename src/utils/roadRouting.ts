import * as THREE from 'three';
import { Location, Road } from '../types/city';
import { getEffectiveDimensions } from './buildingDimensions';
import { ROAD_WIDTH, PAVEMENT_WIDTH } from './scale';

/**
 * Road centre-line routing.
 *
 * Roads used to run from one building's centre to another's, which meant the
 * first and last half-footprint of every road was buried inside a building, and
 * any building sitting between two endpoints had the carriageway driven
 * straight through it.
 *
 * This module produces a centre-line that:
 *   1. starts and ends at the building *edge* rather than its centre, and
 *   2. bends around any other building it would otherwise cut through.
 *
 * Both the road ribbons and the vehicle paths consume this, so traffic follows
 * the tarmac. Previously the two were computed independently — the ribbons had
 * a decorative wobble and the vehicles drove dead straight, so cars floated
 * beside their own roads.
 */

/** Radius of the circle that encloses a building's footprint. */
export function buildingRadius(location: Location): number {
  const { width, depth } = getEffectiveDimensions(location);
  return Math.sqrt((width / 2) ** 2 + (depth / 2) ** 2);
}

/** How far a road must stay from a building's centre to clear it sideways. */
export function sideClearance(location: Location, roadType: Road['type']): number {
  return buildingRadius(location) + ROAD_WIDTH[roadType] / 2 + PAVEMENT_WIDTH;
}

/** How far from a building's centre the road should begin. */
function endpointSetback(location: Location): number {
  return buildingRadius(location) + PAVEMENT_WIDTH * 0.5;
}

const flat = (p: [number, number, number]) => new THREE.Vector2(p[0], p[2]);

export interface RouteOptions {
  /** Buildings the road must avoid. The two endpoints are excluded automatically. */
  obstacles: Location[];
  /**
   * Maximum deflection passes before accepting the best effort. Each pass
   * resolves the single worst remaining violation, so this bounds how many
   * separate obstacles a road can weave around.
   */
  maxPasses?: number;
}

/**
 * Centre-line for a road between two buildings, as world-space points.
 *
 * Returns at least two points. When the buildings are so close that their
 * footprints leave no room, a short direct stub is returned rather than an
 * inverted segment.
 */
export function routeRoad(
  from: Location,
  to: Location,
  roadType: Road['type'],
  { obstacles, maxPasses = 10 }: RouteOptions
): THREE.Vector3[] {
  const a = flat(from.position);
  const b = flat(to.position);

  const axis = new THREE.Vector2().subVectors(b, a);
  const span = axis.length();
  if (span === 0) return [];

  const dir = axis.clone().divideScalar(span);
  const normal = new THREE.Vector2(-dir.y, dir.x);

  // 1. Pull the ends back to the building edges.
  const setbackFrom = endpointSetback(from);
  const setbackTo = endpointSetback(to);

  let start: THREE.Vector2;
  let end: THREE.Vector2;

  if (setbackFrom + setbackTo >= span - 1) {
    // Footprints nearly touch; leave a short stub centred between them so the
    // road is still visible without poking inside either building.
    const mid = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5);
    const stub = Math.max(1, (span - setbackFrom - setbackTo) / 2);
    start = mid.clone().addScaledVector(dir, -stub);
    end = mid.clone().addScaledVector(dir, stub);
    return [
      new THREE.Vector3(start.x, 0, start.y),
      new THREE.Vector3(end.x, 0, end.y)
    ];
  }

  start = a.clone().addScaledVector(dir, setbackFrom);
  end = b.clone().addScaledVector(dir, -setbackTo);

  // 2. Deflect around anything in the way.
  const blockers = obstacles.filter(o => o.id !== from.id && o.id !== to.id);

  /*
    The route is sampled evenly along the axis and each sample carries a lateral
    offset, relaxed over a few passes: push every sample out of any footprint it
    sits inside, then smooth the offsets so the result is a curve rather than a
    set of kinks.

    An earlier attempt inserted discrete bends at the worst violation instead.
    That cannot converge when buildings sit on opposite sides of the road —
    a southward correction for one and a northward one for the next simply
    cancelled, and the road ended up worse than with no routing at all.

    The ends are pinned at zero offset so the road still meets both buildings.
  */
  const SAMPLES = 28;
  const offsets = new Array<number>(SAMPLES + 1).fill(0);

  const sampleAt = (i: number) =>
    new THREE.Vector2()
      .lerpVectors(start, end, i / SAMPLES)
      .addScaledVector(normal, offsets[i]);

  /** Push samples clear of every blocker. Returns true if anything moved. */
  const pushOut = () => {
    let moved = false;

    for (let i = 1; i < SAMPLES; i++) {
      const point = sampleAt(i);

      // Actual spacing to the neighbouring samples. Measured rather than taken
      // from the straight-line step, because a deflected path has longer chords
      // and would otherwise be under-padded exactly where it bends most.
      const localStep = Math.max(
        point.distanceTo(sampleAt(i - 1)),
        point.distanceTo(sampleAt(i + 1))
      );

      for (const blocker of blockers) {
        const centre = flat(blocker.position);

        /*
          Clearance is padded to account for chord sag.

          Pushing the *samples* to exactly the clearance radius isn't enough:
          the road is drawn as straight segments between them, and a chord
          across a circle passes closer to the centre than its endpoints do.
          Without this the tarmac clipped the corner of every building it
          routed around, by about a metre.

          For the chord midpoint to sit at `required`, the endpoints must be at
          sqrt(required² + (chord/2)²) — exact, rather than the step²/8r
          approximation, which still left a few centimetres of overlap.
        */
        const required = sideClearance(blocker, roadType);
        const half = localStep / 2;
        const clearance = Math.sqrt(required * required + half * half) + 0.05;

        if (point.distanceTo(centre) >= clearance) continue;

        /*
          Samples can only move sideways (along the normal), so work out how far
          that actually has to be.

          With `along` the distance from the blocker measured down the road and
          `lat` the distance across it, the sample clears when

              along² + lat'²  >=  clearance²

          so the required lateral distance is sqrt(clearance² - along²).
          Simply adding (clearance - distance) — the obvious first guess — always
          undershoots, because it treats a diagonal gap as if it were lateral.
        */
        const v = new THREE.Vector2().subVectors(point, centre);
        const along = v.dot(dir);
        const lat = v.dot(normal);

        const needed = Math.sqrt(Math.max(0, clearance * clearance - along * along));
        if (needed <= Math.abs(lat)) continue;

        // Dead on the centre-line: pick the side the blocker is *not* on.
        const sign = Math.abs(lat) < 1e-6
          ? (-new THREE.Vector2().subVectors(centre, start).dot(normal) >= 0 ? 1 : -1)
          : Math.sign(lat);

        offsets[i] += sign * (needed - Math.abs(lat));
        moved = true;
      }
    }

    return moved;
  };

  /** Blur the offsets so the road curves instead of stepping. */
  const relax = () => {
    const next = offsets.slice();
    for (let i = 1; i < SAMPLES; i++) {
      next[i] = (offsets[i - 1] + offsets[i] * 2 + offsets[i + 1]) / 4;
    }
    next[0] = 0;
    next[SAMPLES] = 0;
    for (let i = 0; i <= SAMPLES; i++) offsets[i] = next[i];
  };

  for (let pass = 0; pass < maxPasses; pass++) {
    if (!pushOut()) break;
    relax();
  }
  // Final push with no smoothing after it, so clearance is actually satisfied
  // rather than being blurred back into a building.
  pushOut();

  const deflected = offsets.some(o => Math.abs(o) > 1e-6);
  if (!deflected) {
    return [
      new THREE.Vector3(start.x, 0, start.y),
      new THREE.Vector3(end.x, 0, end.y)
    ];
  }

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = sampleAt(i);
    points.push(new THREE.Vector3(p.x, 0, p.y));
  }
  return points;
}

/*
  There is deliberately no smoothing step. `routeRoad` already returns either a
  straight two-point line or a densely sampled relaxed curve, and running a
  spline through the latter would cut the corners it just worked to create —
  putting the tarmac back inside the buildings it routed around.
*/
