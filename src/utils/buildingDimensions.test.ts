import { describe, it, expect } from 'vitest';
import {
  getBuildingDimensions,
  getBuildingHeight,
  hashUnit
} from './buildingDimensions';
import { Location } from '../types/city';

const loc = (over: Partial<Location> = {}): Location => ({
  id: 'loc-1',
  name: 'Test',
  type: 'Building',
  position: [0, 0, 0],
  description: '',
  ...over
});

describe('hashUnit', () => {
  it('is deterministic for the same id', () => {
    // The regression this guards: per-building variation was Math.random(),
    // so the city reshuffled on every render.
    expect(hashUnit('abc')).toBe(hashUnit('abc'));
    expect(hashUnit('a-longer-uuid-like-string')).toBe(
      hashUnit('a-longer-uuid-like-string')
    );
  });

  it('stays within [0, 1)', () => {
    const ids = ['a', 'b', 'zzz', '', '123e4567-e89b-12d3-a456-426614174000'];
    for (const id of ids) {
      const v = hashUnit(id);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('spreads different ids across the range', () => {
    const values = Array.from({ length: 50 }, (_, i) => hashUnit(`building-${i}`));
    const unique = new Set(values);
    // Not a strict distribution claim, just that it isn't a constant.
    expect(unique.size).toBeGreaterThan(20);
  });
});

describe('getBuildingDimensions', () => {
  it('returns the documented footprint per type', () => {
    expect(getBuildingDimensions('Building')).toEqual({ width: 20, height: 40, depth: 20 });
    expect(getBuildingDimensions('Hospital')).toEqual({ width: 30, height: 30, depth: 30 });
    expect(getBuildingDimensions('Hotel')).toEqual({ width: 20, height: 50, depth: 20 });
  });

  it('groups the small-retail types together', () => {
    const shop = getBuildingDimensions('Shop');
    expect(getBuildingDimensions('Restaurant')).toEqual(shop);
    expect(getBuildingDimensions('Cafe')).toEqual(shop);
  });

  it('falls back to a default for unknown types', () => {
    expect(getBuildingDimensions('Spaceport')).toEqual({ width: 20, height: 20, depth: 20 });
  });
});

describe('getBuildingHeight', () => {
  it('is stable across calls for the same building', () => {
    const b = loc({ id: 'stable-id' });
    expect(getBuildingHeight(b)).toBe(getBuildingHeight(b));
  });

  it('varies between buildings of the same type', () => {
    const a = getBuildingHeight(loc({ id: 'aaa' }));
    const b = getBuildingHeight(loc({ id: 'bbb' }));
    expect(a).not.toBe(b);
  });

  it('stays within the 0.85x - 1.25x band of the base height', () => {
    const base = getBuildingDimensions('Building').height;
    for (let i = 0; i < 100; i++) {
      const h = getBuildingHeight(loc({ id: `id-${i}` }));
      expect(h).toBeGreaterThanOrEqual(base * 0.85);
      expect(h).toBeLessThanOrEqual(base * 1.25);
    }
  });
});
