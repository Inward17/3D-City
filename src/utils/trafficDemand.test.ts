import { describe, it, expect } from 'vitest';
import { computeTrafficDemand, MAX_VEHICLES } from './trafficDemand';
import { Location, Road } from '../types/city';

const loc = (id: string, over: Partial<Location> = {}): Location => ({
  id,
  name: id,
  type: 'Building',
  position: [0, 0, 0],
  description: '',
  zone: 'commercial',
  ...over
});

const road = (from: string, to: string): Road => ({
  id: `${from}-${to}`,
  from,
  to,
  distance: 100,
  type: 'main'
});

const city = (n: number) => Array.from({ length: n }, (_, i) => loc(`b${i}`));

describe('computeTrafficDemand', () => {
  it('puts no vehicles on a city with no roads', () => {
    const d = computeTrafficDemand(city(20), [], 12, 1);
    expect(d.vehicles).toBe(0);
    expect(d.byType).toEqual({ cars: 0, buses: 0, trucks: 0 });
  });

  it('scales with the number of buildings', () => {
    const roads = [road('b0', 'b1')];
    const small = computeTrafficDemand(city(4), roads, 12, 1);
    const large = computeTrafficDemand(city(40), roads, 12, 1);
    expect(large.vehicles).toBeGreaterThan(small.vehicles);
  });

  it('scales with building size, not just count', () => {
    const roads = [road('a', 'b')];
    const modest = [loc('a'), loc('b')];
    // Same two buildings, but each given many more floors via the design editor.
    const tall = [
      loc('a', { design: { floors: 40 } }),
      loc('b', { design: { floors: 40 } })
    ];

    const a = computeTrafficDemand(modest, roads, 12, 1);
    const b = computeTrafficDemand(tall, roads, 12, 1);
    expect(b.vehicles).toBeGreaterThan(a.vehicles);
  });

  it('responds to a wider footprint', () => {
    const roads = [road('a', 'b')];
    const narrow = [loc('a', { design: { width: 10, depth: 10 } }), loc('b')];
    const wide = [loc('a', { design: { width: 70, depth: 70 } }), loc('b')];

    expect(computeTrafficDemand(wide, roads, 12, 1).vehicles)
      .toBeGreaterThan(computeTrafficDemand(narrow, roads, 12, 1).vehicles);
  });

  it('applies the user rate multiplier', () => {
    const roads = [road('b0', 'b1')];
    const single = computeTrafficDemand(city(6), roads, 12, 1);
    const double = computeTrafficDemand(city(6), roads, 12, 2);

    // Only meaningful below the ceiling, so assert that first.
    expect(single.capped).toBe(false);
    expect(double.capped).toBe(false);
    expect(double.vehicles).toBeGreaterThan(single.vehicles * 1.8);
  });

  it('leaves headroom for the slider in a mid-sized city', () => {
    // Regression guard on the occupants-per-vehicle ratio: if this saturates,
    // the rate control stops doing anything for most real cities.
    const d = computeTrafficDemand(city(20), [road('b0', 'b1')], 12, 1);
    expect(d.capped).toBe(false);
    expect(d.vehicles).toBeLessThan(MAX_VEHICLES);
  });

  it('clears the roads at rate 0', () => {
    const d = computeTrafficDemand(city(50), [road('b0', 'b1')], 12, 1 * 0);
    expect(d.vehicles).toBe(0);
  });

  it('treats a negative rate as zero', () => {
    const d = computeTrafficDemand(city(50), [road('b0', 'b1')], 12, -5);
    expect(d.vehicles).toBe(0);
  });

  it('never exceeds the instanced pool size', () => {
    const d = computeTrafficDemand(city(400), [road('b0', 'b1')], 12, 3);
    expect(d.vehicles).toBeLessThanOrEqual(MAX_VEHICLES);
    expect(d.capped).toBe(true);
  });

  it('reports capped=false when under the ceiling', () => {
    const d = computeTrafficDemand(city(3), [road('b0', 'b1')], 12, 1);
    expect(d.capped).toBe(false);
  });

  it('follows the time of day', () => {
    const roads = [road('b0', 'b1')];
    const offices = city(30);
    const noon = computeTrafficDemand(offices, roads, 13, 1);
    const night = computeTrafficDemand(offices, roads, 3, 1);
    expect(night.vehicles).toBeLessThan(noon.vehicles);
  });

  it('splits the budget across the three body types', () => {
    const d = computeTrafficDemand(city(60), [road('b0', 'b1')], 12, 1);
    const { cars, buses, trucks } = d.byType;
    expect(cars + buses + trucks).toBe(d.vehicles);
    expect(cars).toBeGreaterThan(buses);
    expect(cars).toBeGreaterThan(trucks);
  });

  it('never produces negative counts for a tiny city', () => {
    for (let n = 0; n <= 6; n++) {
      const d = computeTrafficDemand(city(n), [road('b0', 'b1')], 12, 1);
      expect(d.byType.cars).toBeGreaterThanOrEqual(0);
      expect(d.byType.buses).toBeGreaterThanOrEqual(0);
      expect(d.byType.trucks).toBeGreaterThanOrEqual(0);
      expect(d.byType.cars + d.byType.buses + d.byType.trucks).toBe(d.vehicles);
    }
  });

  it('is deterministic', () => {
    const roads = [road('b0', 'b1')];
    expect(computeTrafficDemand(city(12), roads, 12, 1))
      .toEqual(computeTrafficDemand(city(12), roads, 12, 1));
  });
});
