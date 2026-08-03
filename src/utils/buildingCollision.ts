import { Location } from '../types/city';
import { getEffectiveDimensions, getBuildingDimensions, DESIGN_LIMITS } from './buildingDimensions';

/**
 * Footprint collision.
 *
 * Buildings are axis-aligned boxes centred on their position, so overlap is a
 * plain rectangle intersection test. Nothing enforced this before: the design
 * editor let width and depth grow to their absolute limits regardless of what
 * stood next door, and placement would happily drop a new building on top of an
 * existing one.
 */

/** Minimum space left between two buildings, for access and daylight. */
export const MIN_BUILDING_GAP = 6;

export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function footprintOf(
  location: Pick<Location, 'id' | 'type' | 'design' | 'position'>
): Footprint {
  const { width, depth } = getEffectiveDimensions(location);
  const [x, , z] = location.position;
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  };
}

/** Footprint for a hypothetical building of `type` at `position`. */
export function footprintAt(
  position: [number, number, number],
  width: number,
  depth: number
): Footprint {
  return {
    minX: position[0] - width / 2,
    maxX: position[0] + width / 2,
    minZ: position[2] - depth / 2,
    maxZ: position[2] + depth / 2
  };
}

/**
 * Distance from a point to the nearest edge of a footprint, in the ground
 * plane. Zero when the point is inside it.
 */
export function distanceToFootprint(x: number, z: number, box: Footprint): number {
  const dx = Math.max(box.minX - x, 0, x - box.maxX);
  const dz = Math.max(box.minZ - z, 0, z - box.maxZ);
  return Math.hypot(dx, dz);
}

/** Distance from a point to the closest building, or Infinity if there are none. */
export function distanceToNearestBuilding(
  x: number,
  z: number,
  buildings: Location[]
): number {
  let best = Infinity;
  for (const building of buildings) {
    best = Math.min(best, distanceToFootprint(x, z, footprintOf(building)));
  }
  return best;
}

export function footprintsIntersect(a: Footprint, b: Footprint, gap = MIN_BUILDING_GAP): boolean {
  return (
    a.minX - gap < b.maxX &&
    a.maxX + gap > b.minX &&
    a.minZ - gap < b.maxZ &&
    a.maxZ + gap > b.minZ
  );
}

/** The first building `footprint` collides with, or null if the spot is clear. */
export function findCollision(
  footprint: Footprint,
  others: Location[],
  gap = MIN_BUILDING_GAP
): Location | null {
  for (const other of others) {
    if (footprintsIntersect(footprint, footprintOf(other), gap)) return other;
  }
  return null;
}

/** Can a building of these dimensions stand at this position? */
export function isPlacementClear(
  position: [number, number, number],
  type: Location['type'],
  others: Location[],
  gap = MIN_BUILDING_GAP
): boolean {
  const { width, depth } = getBuildingDimensions(type);
  return findCollision(footprintAt(position, width, depth), others, gap) === null;
}

/**
 * A circle a building may not grow into: a sample of carriageway, a roundabout.
 *
 * Circles rather than boxes because roads run at any angle. Approximating a
 * diagonal corridor with axis-aligned squares over-constrains badly — the
 * squares' corners stick out 40% past the kerb, which capped a 20 m building
 * beside a 45° road at 11 m, below the size it already was.
 *
 * `radius` is the whole no-build circle: carriageway half-width plus the
 * pavement setback.
 */
export interface KeepOut {
  x: number;
  z: number;
  radius: number;
}

/**
 * Largest width and depth this building can take before hitting something.
 *
 * The two axes are coupled — whether an obstacle is "beside" or "in front of"
 * you depends on your own extent — so each is solved against the *current*
 * value of the other. That matches how the editor is used: one slider at a time.
 *
 * @param keepOut road corridors and roundabouts, from `roadKeepOuts`.
 */
export function maxDimensionsFor(
  location: Location,
  others: Location[],
  keepOut: KeepOut[] = [],
  gap = MIN_BUILDING_GAP
): { width: number; depth: number } {
  const current = getEffectiveDimensions(location);
  const [x, , z] = location.position;

  const neighbours = others.filter(o => o.id !== location.id);

  let maxHalfWidth = DESIGN_LIMITS.width.max / 2;
  let maxHalfDepth = DESIGN_LIMITS.depth.max / 2;

  for (const other of neighbours) {
    const box = footprintOf(other);
    const otherHalfWidth = (box.maxX - box.minX) / 2;
    const otherHalfDepth = (box.maxZ - box.minZ) / 2;
    const otherX = (box.minX + box.maxX) / 2;
    const otherZ = (box.minZ + box.maxZ) / 2;

    const dx = Math.abs(x - otherX);
    const dz = Math.abs(z - otherZ);

    // Widening only hits this neighbour if we already overlap it in Z.
    const overlapsInZ = dz < current.depth / 2 + otherHalfDepth + gap;
    if (overlapsInZ) {
      maxHalfWidth = Math.min(maxHalfWidth, dx - otherHalfWidth - gap);
    }

    const overlapsInX = dx < current.width / 2 + otherHalfWidth + gap;
    if (overlapsInX) {
      maxHalfDepth = Math.min(maxHalfDepth, dz - otherHalfDepth - gap);
    }
  }

  /*
    Road circles are solved exactly rather than approximated by a box either
    way round: the nearest point of the footprint must stay `radius` from the
    circle's centre. Inverting `distanceToFootprint` for one axis at a time
    gives the limit directly, with no slack lost on a diagonal road and none
    wrongly taken from a long thin building.
  */
  for (const o of keepOut) {
    const dx = Math.abs(x - o.x);
    const dz = Math.abs(z - o.z);

    // How far the footprint already sticks out past the circle on the *other*
    // axis; if that alone clears the radius, this axis is unconstrained.
    const beyondZ = Math.max(dz - current.depth / 2, 0);
    if (beyondZ < o.radius) {
      maxHalfWidth = Math.min(
        maxHalfWidth, dx - Math.sqrt(o.radius ** 2 - beyondZ ** 2)
      );
    }

    const beyondX = Math.max(dx - current.width / 2, 0);
    if (beyondX < o.radius) {
      maxHalfDepth = Math.min(
        maxHalfDepth, dz - Math.sqrt(o.radius ** 2 - beyondX ** 2)
      );
    }
  }

  return {
    width: Math.max(DESIGN_LIMITS.width.min, Math.floor(maxHalfWidth * 2)),
    depth: Math.max(DESIGN_LIMITS.depth.min, Math.floor(maxHalfDepth * 2))
  };
}

/**
 * Nudge a proposed footprint size down until it fits.
 * Used as a backstop in the store so state can't be driven into an overlap even
 * if a caller ignores the limits the UI advertises.
 */
export function clampDesignToNeighbours(
  location: Location,
  others: Location[],
  proposed: { width?: number; depth?: number },
  keepOut: KeepOut[] = [],
  gap = MIN_BUILDING_GAP
): { width?: number; depth?: number } {
  const limits = maxDimensionsFor(location, others, keepOut, gap);
  const out: { width?: number; depth?: number } = {};

  if (proposed.width != null) out.width = Math.min(proposed.width, limits.width);
  if (proposed.depth != null) out.depth = Math.min(proposed.depth, limits.depth);

  return out;
}
