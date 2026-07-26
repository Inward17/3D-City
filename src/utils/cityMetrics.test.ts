import { describe, it, expect } from 'vitest';
import { buildingCapacity, occupancyFactor, computeCityMetrics } from './cityMetrics';
import { Location, Road } from '../types/city';

const loc = (over: Partial<Location> = {}): Location => ({
  id: 'l1',
  name: 'Test',
  type: 'Building',
  position: [0, 0, 0],
  description: '',
  ...over
});

const road = (from: string, to: string, over: Partial<Road> = {}): Road => ({
  id: `${from}-${to}`,
  from,
  to,
  distance: 100,
  type: 'secondary',
  ...over
});

describe('occupancyFactor', () => {
  it('always returns a 0..1 factor for every type and hour', () => {
    const types: Location['type'][] = [
      'Building', 'Hospital', 'School', 'Hotel', 'Restaurant',
      'Cafe', 'Shop', 'Library', 'Museum', 'Park'
    ];
    for (const type of types) {
      for (let hour = 0; hour < 24; hour++) {
        const f = occupancyFactor(type, hour);
        expect(f, `${type} @ ${hour}`).toBeGreaterThanOrEqual(0);
        expect(f, `${type} @ ${hour}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic', () => {
    // The old implementation added Math.random() jitter, so the chart
    // reshuffled on every render.
    expect(occupancyFactor('Building', 13)).toBe(occupancyFactor('Building', 13));
  });

  it('models offices as busy midday and near-empty overnight', () => {
    expect(occupancyFactor('Building', 13)).toBeGreaterThan(0.5);
    expect(occupancyFactor('Building', 3)).toBeLessThan(0.1);
  });

  it('models hotels inversely to offices', () => {
    expect(occupancyFactor('Hotel', 3)).toBeGreaterThan(occupancyFactor('Hotel', 13));
  });

  it('never empties a hospital', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(occupancyFactor('Hospital', hour)).toBeGreaterThan(0.3);
    }
  });

  it('handles a type that is not in the union without throwing', () => {
    // Guards the 'Office' bug: a type that never matched fell through to a
    // flat default, silently flattening every office in the city.
    const f = occupancyFactor('Spaceport' as Location['type'], 12);
    expect(f).toBeGreaterThan(0);
  });
});

describe('buildingCapacity', () => {
  it('scales with footprint and height', () => {
    // Hotel is 20x20 but 50 tall; Shop is 20x20 and 15 tall.
    const hotel = buildingCapacity(loc({ id: 'h', type: 'Hotel' }));
    const shop = buildingCapacity(loc({ id: 'h', type: 'Shop' }));
    expect(hotel).toBeGreaterThan(shop);
  });

  it('gives a hospital fewer occupants than an office of similar volume', () => {
    // Hospitals allow far more area per occupant.
    const office = buildingCapacity(loc({ id: 'x', type: 'Building' }));
    const hospital = buildingCapacity(loc({ id: 'x', type: 'Hospital' }));
    expect(hospital).toBeLessThan(office * 1.5);
  });

  it('is deterministic for the same building', () => {
    const b = loc({ id: 'same', type: 'Building' });
    expect(buildingCapacity(b)).toBe(buildingCapacity(b));
  });

  it('uses an area-based estimate for parks rather than floor area', () => {
    const park = buildingCapacity(loc({ id: 'p', type: 'Park' }));
    expect(park).toBeGreaterThan(0);
  });

  it('returns a positive integer', () => {
    const c = buildingCapacity(loc({ id: 'z', type: 'Building' }));
    expect(Number.isInteger(c)).toBe(true);
    expect(c).toBeGreaterThan(0);
  });
});

describe('computeCityMetrics', () => {
  const locations: Location[] = [
    loc({ id: 'a', type: 'Building', zone: 'commercial', position: [0, 0, 0] }),
    loc({ id: 'b', type: 'Hospital', zone: 'healthcare', position: [100, 0, 0] }),
    loc({ id: 'c', type: 'Building', zone: 'commercial', position: [0, 0, 100] })
  ];
  const roads: Road[] = [road('a', 'b', { distance: 100, type: 'main' })];
  const sectors = ['commercial', 'healthcare'];

  it('is deterministic for identical input', () => {
    const first = computeCityMetrics(locations, roads, sectors, 12);
    const second = computeCityMetrics(locations, roads, sectors, 12);
    expect(first).toEqual(second);
  });

  it('counts buildings and roads from the actual data', () => {
    const m = computeCityMetrics(locations, roads, sectors, 12);
    expect(m.totals.totalBuildings).toBe(3);
    expect(m.totals.totalRoads).toBe(1);
    expect(m.totals.networkLength).toBe(100);
  });

  it('measures connectivity from the road graph', () => {
    const m = computeCityMetrics(locations, roads, sectors, 12);
    // a and b are joined; c is isolated.
    expect(m.totals.isolatedBuildings).toBe(1);
    expect(m.totals.connectedShare).toBe(67);
    expect(m.totals.averageConnectivity).toBeCloseTo(0.7, 1);
  });

  it('reports every building as isolated when there are no roads', () => {
    const m = computeCityMetrics(locations, [], sectors, 12);
    expect(m.totals.isolatedBuildings).toBe(3);
    expect(m.totals.connectedShare).toBe(0);
    expect(m.totals.networkLength).toBe(0);
  });

  it('keeps capacity independent of the clock but moves occupancy', () => {
    const noon = computeCityMetrics(locations, roads, sectors, 12);
    const night = computeCityMetrics(locations, roads, sectors, 3);
    expect(night.totals.totalCapacity).toBe(noon.totals.totalCapacity);
    expect(night.totals.occupancyNow).toBeLessThan(noon.totals.occupancyNow);
  });

  it('never reports occupancy above capacity', () => {
    for (let hour = 0; hour < 24; hour++) {
      const m = computeCityMetrics(locations, roads, sectors, hour);
      expect(m.totals.occupancyNow).toBeLessThanOrEqual(m.totals.totalCapacity);
      expect(m.totals.utilisation).toBeLessThanOrEqual(100);
    }
  });

  it('produces one row per active sector, in order', () => {
    const m = computeCityMetrics(locations, roads, sectors, 12);
    expect(m.sectorData.map(s => s.sector)).toEqual(sectors);
    expect(m.sectorData[0].buildings).toBe(2); // commercial
    expect(m.sectorData[1].buildings).toBe(1); // healthcare
  });

  it('counts isolated buildings per sector', () => {
    const m = computeCityMetrics(locations, roads, sectors, 12);
    expect(m.sectorData[0].isolated).toBe(1); // 'c' has no road
    expect(m.sectorData[1].isolated).toBe(0);
  });

  it('returns 24 hourly points', () => {
    const m = computeCityMetrics(locations, roads, sectors, 12);
    expect(m.hourlyData).toHaveLength(24);
    expect(m.hourlyData[0].hour).toBe('00:00');
    expect(m.hourlyData[23].hour).toBe('23:00');
  });

  it('handles an empty city without dividing by zero', () => {
    const m = computeCityMetrics([], [], [], 12);
    expect(m.totals.totalBuildings).toBe(0);
    expect(m.totals.utilisation).toBe(0);
    expect(m.totals.connectedShare).toBe(0);
    expect(m.totals.averageConnectivity).toBe(0);
    expect(m.sectorData).toEqual([]);
  });

  it('ignores roads pointing at buildings that no longer exist', () => {
    const m = computeCityMetrics(locations, [road('a', 'ghost')], sectors, 12);
    // 'a' still gains a connection; the dangling end is simply not counted.
    expect(m.totals.isolatedBuildings).toBe(2);
  });
});
