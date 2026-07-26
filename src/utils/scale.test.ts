import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  CAR, BUS, TRUCK, ROAD_WIDTH, STREET_LAMP, BENCH, STREET_TREE, PARK_TREE,
  withinTolerance
} from './scale';
import { createCarGeometry, createBusGeometry, createTruckGeometry } from './vehicleGeometries';
import { createRoadRibbon, createCentreLine } from './roadGeometry';
import { getBuildingDimensions, STOREY_HEIGHT } from './buildingDimensions';

/** Axis-aligned size of a geometry, in world units. */
function sizeOf(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox!;
  return {
    x: b.max.x - b.min.x,
    y: b.max.y - b.min.y,
    z: b.max.z - b.min.z,
    minY: b.min.y
  };
}

describe('scale reference', () => {
  it('keeps vehicles smaller than the roads they drive on', () => {
    // The original geometry had 4 m wide cars on a "2.5 wide" road.
    expect(CAR.width).toBeLessThan(ROAD_WIDTH.residential / 2);
    expect(BUS.width).toBeLessThan(ROAD_WIDTH.secondary / 2);
    expect(TRUCK.width).toBeLessThan(ROAD_WIDTH.secondary / 2);
  });

  it('keeps a bench far shorter than a bus', () => {
    // It used to be 12 m long — the same length as the bus.
    expect(BENCH.length).toBeLessThan(BUS.length / 4);
  });

  it('keeps street lamps at human scale, not building scale', () => {
    const officeHeight = getBuildingDimensions('Building').height;
    expect(STREET_LAMP.height).toBeLessThan(officeHeight / 3);
    // Previously 30 m — taller than eight storeys.
    expect(STREET_LAMP.height).toBeLessThan(STOREY_HEIGHT * 4);
  });

  it('keeps trees between lamp height and building height', () => {
    expect(STREET_TREE.totalHeight).toBeGreaterThan(BENCH.seatHeight);
    expect(STREET_TREE.totalHeight).toBeLessThan(getBuildingDimensions('Building').height);
    expect(PARK_TREE.trunkHeight).toBeLessThan(STREET_TREE.trunkHeight);
  });

  it('orders road widths sensibly', () => {
    expect(ROAD_WIDTH.main).toBeGreaterThan(ROAD_WIDTH.secondary);
    expect(ROAD_WIDTH.secondary).toBeGreaterThan(ROAD_WIDTH.residential);
    // A main road must fit two buses side by side.
    expect(ROAD_WIDTH.main).toBeGreaterThan(BUS.width * 2);
  });

  it('withinTolerance behaves', () => {
    expect(withinTolerance(10, 10)).toBe(true);
    expect(withinTolerance(12, 10, 0.25)).toBe(true);
    expect(withinTolerance(20, 10, 0.25)).toBe(false);
  });
});

describe('vehicle geometry', () => {
  const cases = [
    ['car', createCarGeometry, CAR],
    ['bus', createBusGeometry, BUS],
    ['truck', createTruckGeometry, TRUCK]
  ] as const;

  it.each(cases)('%s matches its reference dimensions', (_name, build, ref) => {
    const size = sizeOf(build());
    // X is length (forward axis), Z is width.
    expect(withinTolerance(size.x, ref.length, 0.15)).toBe(true);
    expect(withinTolerance(size.z, ref.width, 0.2)).toBe(true);
    expect(withinTolerance(size.y, ref.height, 0.25)).toBe(true);
  });

  it.each(cases)('%s sits on the ground rather than floating', (_name, build) => {
    const size = sizeOf(build());
    // Wheels should touch y = 0; allow a hair for tyre tessellation.
    expect(Math.abs(size.minY)).toBeLessThan(0.05);
  });

  it.each(cases)('%s is longer than it is wide', (_name, build) => {
    const size = sizeOf(build());
    expect(size.x).toBeGreaterThan(size.z);
  });
});

describe('road geometry', () => {
  const straight = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 0, 0)];

  it('builds a ribbon at the requested world width', () => {
    const geo = createRoadRibbon(straight, ROAD_WIDTH.main, 0.08)!;
    const size = sizeOf(geo);
    expect(size.x).toBeCloseTo(100, 1);
    expect(size.z).toBeCloseTo(ROAD_WIDTH.main, 1);
  });

  it('lies flat at the requested height', () => {
    const geo = createRoadRibbon(straight, 8, 0.08)!;
    const size = sizeOf(geo);
    expect(size.y).toBeCloseTo(0, 5);
    expect(size.minY).toBeCloseTo(0.08, 5);
  });

  it('is wide enough for the traffic it carries', () => {
    const geo = createRoadRibbon(straight, ROAD_WIDTH.residential, 0.08)!;
    expect(sizeOf(geo).z).toBeGreaterThan(CAR.width);
  });

  it('returns null for a degenerate path', () => {
    expect(createRoadRibbon([], 10, 0)).toBeNull();
    expect(createRoadRibbon([new THREE.Vector3()], 10, 0)).toBeNull();
  });

  it('follows a diagonal path', () => {
    const geo = createRoadRibbon(
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 0, 100)],
      10, 0.08
    )!;
    const size = sizeOf(geo);
    expect(size.x).toBeGreaterThan(100);
    expect(size.z).toBeGreaterThan(100);
  });

  it('produces centre-line dashes for a long enough road', () => {
    const geo = createCentreLine(straight, 0.12);
    expect(geo).not.toBeNull();
    expect(geo!.getAttribute('position').count).toBeGreaterThan(4);
  });

  it('skips markings on a very short road', () => {
    const short = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0)];
    expect(createCentreLine(short, 0.12)).toBeNull();
  });
});
