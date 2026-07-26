import { describe, it, expect } from 'vitest';
import {
  getEffectiveDimensions,
  getBuildingDimensions,
  DESIGN_LIMITS,
  STOREY_HEIGHT
} from './buildingDimensions';
import { buildingCapacity, derivedCapacity } from './cityMetrics';
import { Location } from '../types/city';

const loc = (over: Partial<Location> = {}): Location => ({
  id: 'b1',
  name: 'Test',
  type: 'Building',
  position: [0, 0, 0],
  description: '',
  ...over
});

describe('getEffectiveDimensions', () => {
  it('falls back to the type footprint when nothing is customised', () => {
    const base = getBuildingDimensions('Building');
    const dims = getEffectiveDimensions(loc());
    expect(dims.width).toBe(base.width);
    expect(dims.depth).toBe(base.depth);
  });

  it('keeps the stable height variation when floors are not set', () => {
    const a = getEffectiveDimensions(loc({ id: 'x' }));
    const b = getEffectiveDimensions(loc({ id: 'x' }));
    expect(a.height).toBe(b.height);
  });

  it('uses an exact height when floors are set, with no variation', () => {
    const dims = getEffectiveDimensions(loc({ design: { floors: 10 } }));
    expect(dims.height).toBe(10 * STOREY_HEIGHT);
    expect(dims.floors).toBe(10);
  });

  it('applies width and depth overrides', () => {
    const dims = getEffectiveDimensions(loc({ design: { width: 45, depth: 15 } }));
    expect(dims.width).toBe(45);
    expect(dims.depth).toBe(15);
  });

  it('clamps values beyond the design limits', () => {
    const huge = getEffectiveDimensions(
      loc({ design: { width: 9999, depth: 9999, floors: 9999 } })
    );
    expect(huge.width).toBe(DESIGN_LIMITS.width.max);
    expect(huge.depth).toBe(DESIGN_LIMITS.depth.max);
    expect(huge.floors).toBe(DESIGN_LIMITS.floors.max);

    const tiny = getEffectiveDimensions(
      loc({ design: { width: -10, depth: 0, floors: 0 } })
    );
    expect(tiny.width).toBe(DESIGN_LIMITS.width.min);
    expect(tiny.depth).toBe(DESIGN_LIMITS.depth.min);
    expect(tiny.floors).toBe(DESIGN_LIMITS.floors.min);
  });

  it('lets a partial design override only what it names', () => {
    const base = getBuildingDimensions('Hotel');
    const dims = getEffectiveDimensions(loc({ type: 'Hotel', design: { width: 30 } }));
    expect(dims.width).toBe(30);
    expect(dims.depth).toBe(base.depth);
  });

  it('always reports at least one floor', () => {
    expect(getEffectiveDimensions(loc({ type: 'Shop' })).floors).toBeGreaterThanOrEqual(1);
  });
});

describe('design feeds the capacity model', () => {
  it('increases capacity when floors are added', () => {
    const small = buildingCapacity(loc({ design: { floors: 4 } }));
    const tall = buildingCapacity(loc({ design: { floors: 40 } }));
    expect(tall).toBeGreaterThan(small);
  });

  it('increases capacity when the footprint grows', () => {
    const narrow = buildingCapacity(loc({ design: { width: 10, depth: 10, floors: 10 } }));
    const wide = buildingCapacity(loc({ design: { width: 60, depth: 60, floors: 10 } }));
    expect(wide).toBeGreaterThan(narrow);
  });

  it('scales roughly linearly with floor count', () => {
    const ten = buildingCapacity(loc({ design: { floors: 10 } }));
    const twenty = buildingCapacity(loc({ design: { floors: 20 } }));
    expect(twenty / ten).toBeGreaterThan(1.8);
    expect(twenty / ten).toBeLessThan(2.2);
  });

  it('leaves park capacity independent of design overrides', () => {
    // Parks are measured by ground area, not floor area.
    const plain = buildingCapacity(loc({ type: 'Park' }));
    const edited = buildingCapacity(loc({ type: 'Park', design: { floors: 40 } }));
    expect(edited).toBe(plain);
  });

  it('is unchanged when the design only sets cosmetic fields', () => {
    const plain = buildingCapacity(loc());
    const painted = buildingCapacity(loc({ design: { color: '#ff0000', roof: 'pitched' } }));
    expect(painted).toBe(plain);
  });
});

describe('population override', () => {
  it('uses the explicit population when one is set', () => {
    expect(buildingCapacity(loc({ design: { population: 1234 } }))).toBe(1234);
  });

  it('wins over the geometric estimate', () => {
    const estimated = buildingCapacity(loc({ design: { floors: 40 } }));
    const pinned = buildingCapacity(loc({ design: { floors: 40, population: 10 } }));
    expect(estimated).toBeGreaterThan(10);
    expect(pinned).toBe(10);
  });

  it('falls back to the estimate when cleared', () => {
    const base = buildingCapacity(loc({ design: { floors: 12 } }));
    const cleared = buildingCapacity(loc({ design: { floors: 12, population: undefined } }));
    expect(cleared).toBe(base);
  });

  it('accepts zero as a real value rather than treating it as unset', () => {
    // A derelict block genuinely holds nobody.
    expect(buildingCapacity(loc({ design: { population: 0 } }))).toBe(0);
  });

  it('ignores a negative or non-finite override', () => {
    const base = buildingCapacity(loc());
    expect(buildingCapacity(loc({ design: { population: -5 } }))).toBe(base);
    expect(buildingCapacity(loc({ design: { population: NaN } }))).toBe(base);
  });

  it('overrides a park too', () => {
    expect(buildingCapacity(loc({ type: 'Park', design: { population: 500 } }))).toBe(500);
  });

  it('derivedCapacity reports the estimate regardless of the override', () => {
    const withOverride = loc({ design: { floors: 12, population: 7 } });
    const estimate = derivedCapacity(withOverride);
    expect(buildingCapacity(withOverride)).toBe(7);
    expect(estimate).toBeGreaterThan(7);
    // ...and matches what the same building would report with no override.
    expect(estimate).toBe(buildingCapacity(loc({ design: { floors: 12 } })));
  });

  it('feeds the traffic model', async () => {
    const { computeTrafficDemand } = await import('./trafficDemand');
    const roads = [{ id: 'r', from: 'a', to: 'b', distance: 10, type: 'main' as const }];
    const quiet = [
      loc({ id: 'a', design: { population: 5 } }),
      loc({ id: 'b', design: { population: 5 } })
    ];
    const busy = [
      loc({ id: 'a', design: { population: 5000 } }),
      loc({ id: 'b', design: { population: 5000 } })
    ];
    expect(computeTrafficDemand(busy, roads, 12, 1).vehicles)
      .toBeGreaterThan(computeTrafficDemand(quiet, roads, 12, 1).vehicles);
  });
});
