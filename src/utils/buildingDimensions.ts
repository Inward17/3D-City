import { Location } from '../types/city';

export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

/** Metres per storey. Shared by the renderer and the capacity model. */
export const STOREY_HEIGHT = 3.5;

/** Bounds the design editor clamps to, also enforced here as a safety net. */
export const DESIGN_LIMITS = {
  width: { min: 8, max: 80 },
  depth: { min: 8, max: 80 },
  floors: { min: 1, max: 60 }
} as const;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Footprint per building type, in world units.
 *
 * Single source of truth. This table previously existed in four places
 * (Buildings, MergedBuildingGeometry, LODBuildings, InstancedWindows) and the
 * copies had drifted, so windows were being placed against different
 * dimensions than the walls they were meant to sit on.
 */
export function getBuildingDimensions(type: Location['type'] | string): Dimensions {
  switch (type) {
    case 'Building':
      return { width: 20, height: 40, depth: 20 };
    case 'Hospital':
      return { width: 30, height: 30, depth: 30 };
    case 'School':
      return { width: 30, height: 20, depth: 30 };
    case 'Hotel':
      return { width: 20, height: 50, depth: 20 };
    case 'Shop':
    case 'Restaurant':
    case 'Cafe':
      return { width: 20, height: 15, depth: 20 };
    case 'Library':
    case 'Museum':
      return { width: 25, height: 20, depth: 25 };
    default:
      return { width: 20, height: 20, depth: 20 };
  }
}

/**
 * Deterministic 0..1 value derived from an id, for stable per-building
 * variation. Math.random() would reshuffle the city on every render.
 */
export function hashUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Height actually drawn for a building, including its per-id variation. */
export function getBuildingHeight(location: Pick<Location, 'id' | 'type' | 'design'>): number {
  return getEffectiveDimensions(location).height;
}

/**
 * Dimensions a building is actually drawn at.
 *
 * Design overrides win; anything the user hasn't set falls back to the type's
 * default footprint with the usual stable per-id height variation. This is the
 * one function the renderer, the window layout and the capacity model all read,
 * so a design edit shows up consistently in the scene and in the analytics.
 */
export function getEffectiveDimensions(
  location: Pick<Location, 'id' | 'type' | 'design'>
): Dimensions & { floors: number } {
  const base = getBuildingDimensions(location.type);
  const design = location.design;

  const width = design?.width != null
    ? clamp(design.width, DESIGN_LIMITS.width.min, DESIGN_LIMITS.width.max)
    : base.width;

  const depth = design?.depth != null
    ? clamp(design.depth, DESIGN_LIMITS.depth.min, DESIGN_LIMITS.depth.max)
    : base.depth;

  // An explicit floor count is exact; otherwise keep the varied height so a
  // row of same-type buildings doesn't read as one flat wall.
  const height = design?.floors != null
    ? clamp(design.floors, DESIGN_LIMITS.floors.min, DESIGN_LIMITS.floors.max) * STOREY_HEIGHT
    : base.height * (0.85 + hashUnit(location.id) * 0.4);

  return {
    width,
    height,
    depth,
    floors: Math.max(1, Math.round(height / STOREY_HEIGHT))
  };
}
