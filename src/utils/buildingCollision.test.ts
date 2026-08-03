import { describe, it, expect } from 'vitest';
import {
  footprintOf, footprintsIntersect, isPlacementClear,
  maxDimensionsFor, clampDesignToNeighbours, MIN_BUILDING_GAP, KeepOut
} from './buildingCollision';
import { getEffectiveDimensions, DESIGN_LIMITS } from './buildingDimensions';
import { Location } from '../types/city';

const at = (id: string, x: number, z: number, over: Partial<Location> = {}): Location => ({
  id,
  name: id,
  type: 'Building',
  position: [x, 0, z],
  description: '',
  zone: 'commercial',
  ...over
});

/** Do two buildings' drawn footprints physically overlap (ignoring the gap)? */
function physicallyOverlap(a: Location, b: Location): boolean {
  return footprintsIntersect(footprintOf(a), footprintOf(b), 0);
}

describe('footprintOf', () => {
  it('is centred on the building and matches its effective size', () => {
    const b = at('b', 100, -40, { design: { width: 30, depth: 18 } });
    const f = footprintOf(b);
    expect(f.maxX - f.minX).toBeCloseTo(30, 6);
    expect(f.maxZ - f.minZ).toBeCloseTo(18, 6);
    expect((f.minX + f.maxX) / 2).toBeCloseTo(100, 6);
    expect((f.minZ + f.maxZ) / 2).toBeCloseTo(-40, 6);
  });

  it('tracks design resizes', () => {
    const before = footprintOf(at('b', 0, 0));
    const after = footprintOf(at('b', 0, 0, { design: { width: 60 } }));
    expect(after.maxX - after.minX).toBeGreaterThan(before.maxX - before.minX);
  });
});

describe('footprintsIntersect', () => {
  it('detects a plain overlap', () => {
    expect(physicallyOverlap(at('a', 0, 0), at('b', 5, 0))).toBe(true);
  });

  it('separates buildings that are clearly apart', () => {
    expect(physicallyOverlap(at('a', 0, 0), at('b', 300, 0))).toBe(false);
  });

  it('requires a gap, not merely non-overlap', () => {
    // Default footprint is 20 wide, so centres 21m apart don't overlap but sit
    // only 1m apart — too close to be a legal pair of plots.
    const a = at('a', 0, 0);
    const b = at('b', 21, 0);
    expect(physicallyOverlap(a, b)).toBe(false);
    expect(footprintsIntersect(footprintOf(a), footprintOf(b), MIN_BUILDING_GAP)).toBe(true);
  });

  it('is symmetric', () => {
    const a = footprintOf(at('a', 0, 0));
    const b = footprintOf(at('b', 12, 4));
    expect(footprintsIntersect(a, b)).toBe(footprintsIntersect(b, a));
  });
});

describe('isPlacementClear', () => {
  const existing = [at('a', 0, 0), at('b', 200, 0)];

  it('rejects dropping a building on top of an existing one', () => {
    expect(isPlacementClear([0, 0, 0], 'Building', existing)).toBe(false);
  });

  it('rejects a spot that is close enough to breach the gap', () => {
    expect(isPlacementClear([22, 0, 0], 'Building', existing)).toBe(false);
  });

  it('accepts open ground', () => {
    expect(isPlacementClear([100, 0, 100], 'Building', existing)).toBe(true);
  });

  it('accounts for the footprint of the type being placed', () => {
    // 'a' occupies -10..10. With a 6m gap a newcomer's near edge must reach 16,
    // so a 20-wide Building fits from x=26 but a 30-wide Hospital needs x=31.
    // x=28 sits between the two.
    const spot: [number, number, number] = [28, 0, 0];
    expect(isPlacementClear(spot, 'Building', existing)).toBe(true);
    expect(isPlacementClear(spot, 'Hospital', existing)).toBe(false);
  });

  it('is clear on an empty map', () => {
    expect(isPlacementClear([0, 0, 0], 'Hotel', [])).toBe(true);
  });
});

describe('maxDimensionsFor', () => {
  it('is unconstrained with no neighbours', () => {
    const fit = maxDimensionsFor(at('a', 0, 0), []);
    expect(fit.width).toBe(DESIGN_LIMITS.width.max);
    expect(fit.depth).toBe(DESIGN_LIMITS.depth.max);
  });

  it('limits width when a neighbour sits close alongside', () => {
    // 40m apart: a 20-wide neighbour spans 30..50, so this building can only
    // reach x=24 before breaching the gap — well under the 80m design limit.
    const a = at('a', 0, 0);
    const b = at('b', 40, 0);
    const fit = maxDimensionsFor(a, [a, b]);
    expect(fit.width).toBeLessThan(DESIGN_LIMITS.width.max);
  });

  it('does not limit width when there is genuinely room', () => {
    // 60m apart leaves space for the full 80m limit; the cap must not be
    // applied more eagerly than the geometry requires.
    const a = at('a', 0, 0);
    const b = at('b', 60, 0);
    expect(maxDimensionsFor(a, [a, b]).width).toBe(DESIGN_LIMITS.width.max);
  });

  it('produces a width that actually fits', () => {
    // The whole point: growing to the advertised limit must not overlap.
    const a = at('a', 0, 0);
    const b = at('b', 40, 0);
    const fit = maxDimensionsFor(a, [a, b]);

    const grown = at('a', 0, 0, { design: { width: fit.width } });
    expect(physicallyOverlap(grown, b)).toBe(false);
  });

  it('leaves at least the minimum gap at the advertised limit', () => {
    const a = at('a', 0, 0);
    const b = at('b', 40, 0);
    const fit = maxDimensionsFor(a, [a, b]);
    const grown = at('a', 0, 0, { design: { width: fit.width } });

    const gap = footprintOf(b).minX - footprintOf(grown).maxX;
    expect(gap).toBeGreaterThanOrEqual(MIN_BUILDING_GAP - 1);
  });

  it('ignores a neighbour that is off to the side in the other axis', () => {
    // Far away in Z, so widening can never reach it.
    const a = at('a', 0, 0);
    const b = at('b', 60, 400);
    expect(maxDimensionsFor(a, [a, b]).width).toBe(DESIGN_LIMITS.width.max);
  });

  it('takes the tightest neighbour when several are present', () => {
    const a = at('a', 0, 0);
    const near = at('near', 50, 0);
    const far = at('far', 120, 0);
    const both = maxDimensionsFor(a, [a, near, far]).width;
    const onlyFar = maxDimensionsFor(a, [a, far]).width;
    expect(both).toBeLessThan(onlyFar);
  });

  it('never returns less than the minimum allowed size', () => {
    // Neighbours pressed right up against it.
    const a = at('a', 0, 0);
    const fit = maxDimensionsFor(a, [a, at('l', 22, 0), at('r', -22, 0)]);
    expect(fit.width).toBeGreaterThanOrEqual(DESIGN_LIMITS.width.min);
  });

  it('does not treat the building itself as a neighbour', () => {
    const a = at('a', 0, 0);
    expect(maxDimensionsFor(a, [a]).width).toBe(DESIGN_LIMITS.width.max);
  });
});

describe('maxDimensionsFor with keep-out obstacles', () => {
  /** A sample of 14 m carriageway plus a 2.5 m pavement, centred at (x, z). */
  const road = (x: number, z: number): KeepOut => ({ x, z, radius: 7 + 2.5 });

  it('caps width at a road that the neighbours alone would allow', () => {
    const a = at('a', 0, 0);
    const open = maxDimensionsFor(a, [a]);
    const beside = maxDimensionsFor(a, [a], [road(30, 0)]);

    expect(open.width).toBe(DESIGN_LIMITS.width.max);
    expect(beside.width).toBeLessThan(open.width);
  });

  it('leaves the far axis alone', () => {
    const a = at('a', 0, 0);
    // A road due east constrains width, not depth.
    expect(maxDimensionsFor(a, [a], [road(30, 0)]).depth)
      .toBe(DESIGN_LIMITS.depth.max);
  });

  it('keeps a pavement between the footprint and the kerb', () => {
    const a = at('a', 0, 0);
    const fit = maxDimensionsFor(a, [a], [road(30, 0)]);
    // Road kerb sits at x = 23; the wall must stop 2.5 m short of it.
    expect(fit.width / 2).toBeLessThanOrEqual(30 - 7 - 2.5);
  });

  it('takes the tighter of a road and a neighbour', () => {
    const a = at('a', 0, 0);
    const far = at('b', 70, 0);
    const withRoad = maxDimensionsFor(a, [a, far], [road(30, 0)]);
    const roadOnly = maxDimensionsFor(a, [a], [road(30, 0)]);
    expect(withRoad.width).toBe(roadOnly.width);
  });

  it('is unaffected by a road far enough away', () => {
    const a = at('a', 0, 0);
    expect(maxDimensionsFor(a, [a], [road(300, 0)]).width)
      .toBe(DESIGN_LIMITS.width.max);
  });

  it('never returns less than the minimum, even hemmed in on both sides', () => {
    const a = at('a', 0, 0);
    const fit = maxDimensionsFor(a, [a], [road(10, 0), road(-10, 0)]);
    expect(fit.width).toBeGreaterThanOrEqual(DESIGN_LIMITS.width.min);
  });

  it('clampDesignToNeighbours honours the same obstacles', () => {
    const a = at('a', 0, 0);
    const clamped = clampDesignToNeighbours(
      a, [a], { width: DESIGN_LIMITS.width.max }, [road(30, 0)]
    );
    expect(clamped.width).toBeLessThan(DESIGN_LIMITS.width.max);
  });
});

describe('clampDesignToNeighbours', () => {
  it('caps an oversized request', () => {
    const a = at('a', 0, 0);
    const b = at('b', 40, 0);
    const clamped = clampDesignToNeighbours(a, [a, b], { width: DESIGN_LIMITS.width.max });
    expect(clamped.width).toBeLessThan(DESIGN_LIMITS.width.max);
  });

  it('leaves a request that already fits alone', () => {
    const a = at('a', 0, 0);
    const clamped = clampDesignToNeighbours(a, [a], { width: 24 });
    expect(clamped.width).toBe(24);
  });

  it('only returns the fields it was asked about', () => {
    const a = at('a', 0, 0);
    const clamped = clampDesignToNeighbours(a, [a], { width: 24 });
    expect(clamped.depth).toBeUndefined();
  });

  it('prevents an overlap when applied', () => {
    const a = at('a', 0, 0);
    const b = at('b', 45, 0);
    const clamped = clampDesignToNeighbours(a, [a, b], { width: 80 });
    const grown = at('a', 0, 0, { design: { width: clamped.width } });
    expect(physicallyOverlap(grown, b)).toBe(false);
  });
});

describe('no configuration can produce overlapping buildings', () => {
  it('holds across a grid of neighbour distances', () => {
    for (let distance = 20; distance <= 120; distance += 5) {
      const a = at('a', 0, 0);
      const b = at('b', distance, 0);

      const fit = maxDimensionsFor(a, [a, b]);
      const grown = at('a', 0, 0, { design: { width: fit.width } });

      expect(
        physicallyOverlap(grown, b),
        `overlap at neighbour distance ${distance} (width ${fit.width})`
      ).toBe(false);
      expect(getEffectiveDimensions(grown).width).toBeLessThanOrEqual(fit.width);
    }
  });
});
