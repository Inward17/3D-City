import * as THREE from 'three';

/**
 * Ground.
 *
 * The site used to be a flat plane, which quietly removed most of what makes a
 * layout hard: roads had no gradient, so a route up a hillside cost exactly what
 * the same distance cost on the flat; buildings needed no platform; and drainage
 * and walkability had nothing to be assessed against.
 *
 * The surface here is deterministic — the same coordinates always give the same
 * height, so a scheme can be compared against itself — and gentle enough that
 * the whole site stays buildable, while still producing gradients steep enough
 * to matter to a lorry.
 */

/**
 * Height of the tallest ground above the lowest, in metres.
 *
 * Raised together with TERRAIN_SCALE rather than on its own: gradient is
 * relief/scale, so scaling both leaves every road grade exactly as it was while
 * making the landform broad enough to read as hills instead of as noise.
 */
export const TERRAIN_RELIEF = 60;

/**
 * Distance over which the main landform rises and falls, in metres.
 *
 * Sized against the city, not against the screen: the shipped layouts span
 * about 800 m, so at 600 m the town sits across one hillside and one valley —
 * "this district is up, that one is down" — instead of on two small waves
 * that the levelled platforms and road corridors then erase. Relief and scale
 * move together, so every road gradient is identical to before.
 */
export const TERRAIN_SCALE = 600;

/**
 * Steepest gradient a road is expected to climb, as a rise/run fraction.
 *
 * 8% is about the practical urban limit — steeper needs hairpins, and buses and
 * lorries struggle. Used to flag routes rather than to prevent them.
 */
export const MAX_ROAD_GRADE = 0.08;

/**
 * Ground height at a point.
 *
 * Three summed waves at incommensurable wavelengths: enough to read as real
 * topography without repeating, and cheap enough to call per vertex and per
 * road sample. Deliberately not random — a heightfield that changed between
 * runs would make two versions of a scheme incomparable.
 */
export function elevationAt(x: number, z: number): number {
  const broad = Math.sin(x / TERRAIN_SCALE) * Math.cos(z / (TERRAIN_SCALE * 1.31));
  const ridge = Math.sin((x + z * 0.7) / (TERRAIN_SCALE * 0.57)) * 0.42;
  const detail = Math.cos((x * 1.3 - z) / (TERRAIN_SCALE * 0.33)) * 0.17;

  // Scaled so the three waves together span roughly TERRAIN_RELIEF.
  return (broad + ridge + detail) * (TERRAIN_RELIEF / 3.18);
}

/** Downhill gradient vector at a point, as (dy/dx, dy/dz). */
export function gradientAt(x: number, z: number, step = 2): [number, number] {
  const dx = (elevationAt(x + step, z) - elevationAt(x - step, z)) / (2 * step);
  const dz = (elevationAt(x, z + step) - elevationAt(x, z - step)) / (2 * step);
  return [dx, dz];
}

/** Steepness of the ground at a point, as a rise/run fraction. */
export function slopeAt(x: number, z: number): number {
  const [dx, dz] = gradientAt(x, z);
  return Math.hypot(dx, dz);
}

/** Ground slope in degrees, for anything reported to a person. */
export function slopeDegreesAt(x: number, z: number): number {
  return (Math.atan(slopeAt(x, z)) * 180) / Math.PI;
}

/**
 * Relief shading baked into the ground's colour, 0 (shadowed) to 1 (lit).
 *
 * A map's hillshade, from a fixed north-west sun — not the scene's sun. That
 * sounds wrong for a 3D view until you look at the site the app defaults to:
 * at 18.5°N in August the noon sun sits 89° above the horizon, so the scene
 * light points almost straight down, casts no shadows at all, and lights every
 * slope identically. The ground was displaced by twenty-odd metres and still
 * looked like a flat green sheet.
 *
 * Terrain legibility should not depend on where the time slider happens to be,
 * any more than a contour map's does.
 */
export const HILLSHADE_AZIMUTH = (315 * Math.PI) / 180;
export const HILLSHADE_STRENGTH = 9;

export function hillshadeAt(x: number, z: number): number {
  const [dx, dz] = gradientAt(x, z);

  // Slope component facing the light, exaggerated because real gradients here
  // are a few percent and would otherwise be invisible.
  const lit =
    dx * Math.cos(HILLSHADE_AZIMUTH) + dz * Math.sin(HILLSHADE_AZIMUTH);

  return Math.min(1, Math.max(0, 0.5 + lit * HILLSHADE_STRENGTH));
}

export interface Grade {
  /** Signed rise/run from the start of the path to its end. Positive is uphill. */
  overall: number;
  /** Steepest uphill section along the way. */
  steepest: number;
  /** Total climb, metres — what a cyclist or a lorry actually feels. */
  ascent: number;
  descent: number;
}

/**
 * Gradient profile of a road.
 *
 * `overall` is what the road costs a vehicle end to end; `steepest` is what
 * decides whether it can be built at all, since a road is limited by its worst
 * section rather than its average.
 */
export function gradeOf(path: THREE.Vector3[]): Grade {
  if (path.length < 2) return { overall: 0, steepest: 0, ascent: 0, descent: 0 };

  let run = 0;
  let steepest = 0;
  let ascent = 0;
  let descent = 0;

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
    if (horizontal <= 0) continue;

    const rise = b.y - a.y;
    run += horizontal;
    steepest = Math.max(steepest, rise / horizontal);
    if (rise > 0) ascent += rise;
    else descent -= rise;
  }

  const first = path[0];
  const last = path[path.length - 1];

  return {
    overall: run > 0 ? (last.y - first.y) / run : 0,
    steepest,
    ascent,
    descent
  };
}

/**
 * How much a gradient costs a road, as multipliers on speed and capacity.
 *
 * Only the uphill direction is penalised: climbing costs power, and heavy
 * vehicles lose speed badly, which is also what drops the flow a lane can
 * carry. Downhill traffic runs at roughly the level rate — drivers do not make
 * up the time they lost coming the other way, which is why the two directions
 * of the same hill are modelled separately.
 */
export const GRADE_SPEED_PENALTY = 6;
export const GRADE_CAPACITY_PENALTY = 4;

export function gradeFactors(grade: number): { speed: number; capacity: number } {
  const uphill = Math.max(0, grade);
  return {
    speed: 1 / (1 + GRADE_SPEED_PENALTY * uphill),
    capacity: 1 / (1 + GRADE_CAPACITY_PENALTY * uphill)
  };
}

/**
 * Earthworks needed to stand a flat building on sloping ground.
 *
 * The platform is set at the mean corner height, so material dug from the high
 * side roughly balances what is filled on the low side — how a pad is actually
 * levelled, and the reason a steep plot costs more to build on than a flat one.
 */
export interface Earthworks {
  /** Finished platform height. */
  level: number;
  /** Cubic metres to excavate. */
  cut: number;
  /** Cubic metres to import or move. */
  fill: number;
}

/**
 * Where a ray meets the ground.
 *
 * Solved against the height function rather than against the ground mesh. The
 * mesh is 320,000 triangles, and three.js raycasting is a brute-force scan of
 * every one of them — with a pointer handler attached that ran on each mouse
 * move and made the whole view stutter. Marching the height function is a few
 * dozen samples regardless of how finely the ground is drawn.
 *
 * @param maxDistance how far to look before giving up, in metres
 */
export function raycastTerrain(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  maxDistance = 6000
): { x: number; y: number; z: number } | null {
  const heightAbove = (t: number) => {
    const x = origin.x + direction.x * t;
    const z = origin.z + direction.z * t;
    return origin.y + direction.y * t - elevationAt(x, z);
  };

  if (heightAbove(0) < 0) return null;   // already underground

  // March until the ray drops below the surface, then bisect the crossing.
  const step = 4;
  let previous = 0;

  for (let t = step; t <= maxDistance; t += step) {
    if (heightAbove(t) <= 0) {
      let low = previous;
      let high = t;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        if (heightAbove(mid) > 0) low = mid;
        else high = mid;
      }
      const hit = (low + high) / 2;
      const x = origin.x + direction.x * hit;
      const z = origin.z + direction.z * hit;
      return { x, y: elevationAt(x, z), z };
    }
    previous = t;
  }

  return null;   // ray never comes down, e.g. pointing at the sky
}

/**
 * Stand something on the ground.
 *
 * `heightAboveGround` is measured up from the surface, not from sea level.
 * Confusing the two is invisible on a flat world and buries everything on the
 * first hillside: street lamps, benches and trees were all placed at their
 * offset as an absolute height and ended up underground.
 *
 * Writes into `into` so it can be reused inside a render loop.
 */
export function placeOnGround(
  ground: THREE.Vector3,
  heightAboveGround: number,
  into = new THREE.Vector3()
): THREE.Vector3 {
  return into.set(ground.x, ground.y + heightAboveGround, ground.z);
}

/**
 * Level a building stands at.
 *
 * Buildings sit on a cut-and-fill platform rather than at the raw ground height
 * under their centre, so a large footprint on a slope stands level — as a real
 * one does — instead of tilting with the hillside or leaving one corner in the
 * air.
 */
export function groundLevelFor(
  location: { position: [number, number, number]; design?: { width?: number; depth?: number } },
  fallbackSize = 20
): number {
  const [x, , z] = location.position;
  const width = location.design?.width ?? fallbackSize;
  const depth = location.design?.depth ?? fallbackSize;
  return earthworksFor(x, z, width, depth).level;
}

export function earthworksFor(
  x: number,
  z: number,
  width: number,
  depth: number,
  samples = 5
): Earthworks {
  const heights: number[] = [];

  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const sx = x - width / 2 + (width * i) / (samples - 1);
      const sz = z - depth / 2 + (depth * j) / (samples - 1);
      heights.push(elevationAt(sx, sz));
    }
  }

  const level = heights.reduce((sum, h) => sum + h, 0) / heights.length;
  const cellArea = (width * depth) / heights.length;

  let cut = 0;
  let fill = 0;
  for (const h of heights) {
    if (h > level) cut += (h - level) * cellArea;
    else fill += (level - h) * cellArea;
  }

  return { level, cut, fill };
}
