import { describe, it, expect } from 'vitest';
import { selectVisibleCity } from './selectVisibleCity';
import { Location, Road } from '../types/city';

const loc = (id: string, zone?: string, over: Partial<Location> = {}): Location => ({
  id,
  name: id,
  type: 'Building',
  position: [0, 0, 0],
  description: '',
  zone: zone as Location['zone'],
  ...over
});

const road = (id: string, from: string, to: string): Road => ({
  id,
  from,
  to,
  distance: 100,
  type: 'main'
});

describe('selectVisibleCity', () => {
  it('shows only locations in the active sectors', () => {
    const locations = [loc('a', 'commercial'), loc('b', 'healthcare'), loc('c', 'green')];
    const { locations: visible } = selectVisibleCity(locations, [], ['commercial', 'green']);
    expect(visible.map(l => l.id)).toEqual(['a', 'c']);
  });

  it('always shows a location with no zone', () => {
    // Regression: a freshly placed building has no zone until it adopts one,
    // and the old filter dropped it immediately, so placement looked broken.
    const locations = [loc('placed', undefined), loc('a', 'commercial')];
    const { locations: visible } = selectVisibleCity(locations, [], ['healthcare']);
    expect(visible.map(l => l.id)).toEqual(['placed']);
  });

  it('shows zone-less locations even when no sectors are active', () => {
    const { locations: visible } = selectVisibleCity([loc('placed', undefined)], [], []);
    expect(visible).toHaveLength(1);
  });

  it('keeps a road only when both endpoints are visible', () => {
    const locations = [loc('a', 'commercial'), loc('b', 'commercial'), loc('c', 'green')];
    const roads = [road('ab', 'a', 'b'), road('ac', 'a', 'c')];

    const { roads: visible } = selectVisibleCity(locations, roads, ['commercial']);
    expect(visible.map(r => r.id)).toEqual(['ab']);
  });

  it('drops roads pointing at buildings that do not exist', () => {
    const locations = [loc('a', 'commercial')];
    const roads = [road('ghost', 'a', 'missing')];

    const { roads: visible } = selectVisibleCity(locations, roads, ['commercial']);
    expect(visible).toHaveLength(0);
  });

  it('connects a zone-less placed building to a visible one', () => {
    const locations = [loc('a', 'commercial'), loc('placed', undefined)];
    const roads = [road('r', 'a', 'placed')];

    const { roads: visible } = selectVisibleCity(locations, roads, ['commercial']);
    expect(visible.map(r => r.id)).toEqual(['r']);
  });

  it('returns empty results for an empty city', () => {
    expect(selectVisibleCity([], [], ['commercial'])).toEqual({ locations: [], roads: [] });
  });

  it('does not mutate its inputs', () => {
    const locations = [loc('a', 'commercial'), loc('b', 'green')];
    const roads = [road('ab', 'a', 'b')];
    const locSnapshot = JSON.stringify(locations);
    const roadSnapshot = JSON.stringify(roads);

    selectVisibleCity(locations, roads, ['commercial']);

    expect(JSON.stringify(locations)).toBe(locSnapshot);
    expect(JSON.stringify(roads)).toBe(roadSnapshot);
  });
});
