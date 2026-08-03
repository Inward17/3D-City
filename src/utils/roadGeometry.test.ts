import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createRoadRibbon, createCentreLine, createTerrainDisc,
  sampleAlongPath, surfaceHeightBeside
} from './roadGeometry';
import { elevationAt, slopeAt } from './terrain';
import { ROAD_SURFACE_Y } from './scale';
import { BRIDGE_CLEARANCE } from './roadCrossings';

/** A stretch of road lying on the ground, running east across a slope. */
function groundLevelPath(fromX: number, toX: number, z: number, step = 8) {
  const points: THREE.Vector3[] = [];
  for (let x = fromX; x <= toX; x += step) {
    points.push(new THREE.Vector3(x, elevationAt(x, z) + ROAD_SURFACE_Y, z));
  }
  return points;
}

/** Every vertex's height above the true ground beneath it. */
function heightsAboveGround(geometry: THREE.BufferGeometry): number[] {
  const position = geometry.getAttribute('position');
  const out: number[] = [];
  for (let i = 0; i < position.count; i++) {
    out.push(position.getY(i) - elevationAt(position.getX(i), position.getZ(i)));
  }
  return out;
}

/** Somewhere the ground is meaningfully tilted, so the test has a cross-slope. */
function steepestZ(atX: number): number {
  let best = { slope: 0, z: 0 };
  for (let z = -400; z <= 400; z += 5) {
    const slope = slopeAt(atX, z);
    if (slope > best.slope) best = { slope, z };
  }
  return best.z;
}

describe('createRoadRibbon on sloping ground', () => {
  const z = steepestZ(0);
  const path = groundLevelPath(-120, 120, z);

  it('has a cross-slope worth testing', () => {
    expect(slopeAt(0, z)).toBeGreaterThan(0.02);
  });

  it('keeps both kerbs on the ground, not just the centre-line', () => {
    /*
      The regression: both edges took the centre-line's height, so a wide
      carriageway was a horizontal strip over tilting ground — buried on the
      uphill side, hanging in the air on the downhill one.
    */
    const ribbon = createRoadRibbon(path, 19, null)!;
    for (const above of heightsAboveGround(ribbon)) {
      expect(above).toBeCloseTo(ROAD_SURFACE_Y, 5);
    }
  });

  it('gets no worse as the road gets wider', () => {
    const wide = createRoadRibbon(path, 40, null)!;
    const error = Math.max(
      ...heightsAboveGround(wide).map(h => Math.abs(h - ROAD_SURFACE_Y))
    );
    expect(error).toBeLessThan(0.01);
  });

  it('still spans the full width', () => {
    const ribbon = createRoadRibbon(path, 19, null)!;
    const position = ribbon.getAttribute('position');

    let widest = 0;
    for (let i = 0; i < position.count; i += 2) {
      widest = Math.max(widest, Math.hypot(
        position.getX(i) - position.getX(i + 1),
        position.getZ(i) - position.getZ(i + 1)
      ));
    }
    expect(widest).toBeCloseTo(19, 1);
  });

  it('leaves an explicit height alone', () => {
    // A constant y means "draw it flat here", and must not be overridden.
    const flat = createRoadRibbon(path, 19, 5)!;
    const position = flat.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      expect(position.getY(i)).toBe(5);
    }
  });
});

describe('createRoadRibbon on a bridge deck', () => {
  const z = steepestZ(0);

  /** The same road, lifted onto a deck well clear of the ground. */
  const deckPath = groundLevelPath(-120, 120, z).map(
    p => new THREE.Vector3(p.x, p.y + BRIDGE_CLEARANCE, p.z)
  );

  it('stays flat across its width rather than following the valley', () => {
    // A deck is a structure, not a surface laid on the ground.
    const ribbon = createRoadRibbon(deckPath, 19, null)!;
    const position = ribbon.getAttribute('position');

    for (let i = 0; i < position.count; i += 2) {
      expect(position.getY(i)).toBeCloseTo(position.getY(i + 1), 6);
    }
  });

  it('keeps its clearance above the ground', () => {
    const ribbon = createRoadRibbon(deckPath, 19, null)!;
    for (const above of heightsAboveGround(ribbon)) {
      expect(above).toBeGreaterThan(1.5);
    }
  });
});

describe('createCentreLine', () => {
  const z = steepestZ(0);
  const path = groundLevelPath(-120, 120, z);

  it('paints the marking onto the road, not at sea level', () => {
    /*
      The offset used to be an absolute height, which is indistinguishable from
      an offset while the world is flat — and buries every marking under the
      hillside the moment it isn't.
    */
    const markings = createCentreLine(path, 0.04)!;
    for (const above of heightsAboveGround(markings)) {
      expect(above).toBeGreaterThan(ROAD_SURFACE_Y);
      expect(above).toBeLessThan(ROAD_SURFACE_Y + 0.2);
    }
  });

  it('returns nothing for a road too short to mark', () => {
    expect(createCentreLine(groundLevelPath(0, 4, z), 0.04)).toBeNull();
  });
});

describe('createTerrainDisc', () => {
  const centre = { x: 0, z: steepestZ(0) };
  const level = elevationAt(centre.x, centre.z);

  it('follows the ground right out to the rim', () => {
    // A flat 60 m circle missed the real surface by over a metre at the edge.
    const disc = createTerrainDisc(centre.x, centre.z, 0, 30, level);
    const position = disc.getAttribute('position');

    for (let i = 0; i < position.count; i++) {
      const worldY = level + position.getY(i);
      const ground = elevationAt(centre.x + position.getX(i), centre.z + position.getZ(i));
      expect(worldY).toBeCloseTo(ground, 5);
    }
  });

  it('covers the full radius', () => {
    const disc = createTerrainDisc(centre.x, centre.z, 0, 30, level);
    const position = disc.getAttribute('position');

    let furthest = 0;
    for (let i = 0; i < position.count; i++) {
      furthest = Math.max(furthest, Math.hypot(position.getX(i), position.getZ(i)));
    }
    expect(furthest).toBeCloseTo(30, 1);
  });

  it('leaves a hole when given an inner radius', () => {
    const ring = createTerrainDisc(centre.x, centre.z, 30, 32.5, level);
    const position = ring.getAttribute('position');

    let nearest = Infinity;
    for (let i = 0; i < position.count; i++) {
      nearest = Math.min(nearest, Math.hypot(position.getX(i), position.getZ(i)));
    }
    expect(nearest).toBeCloseTo(30, 1);
  });

  it('produces a complete, closed surface', () => {
    const disc = createTerrainDisc(centre.x, centre.z, 0, 30, level);
    expect(disc.getIndex()!.count % 3).toBe(0);
    expect(disc.getIndex()!.count).toBeGreaterThan(0);
  });
});

describe('sampleAlongPath', () => {
  const straight = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(100, 0, 0)
  ];

  it('spaces samples by real distance along the road', () => {
    const samples = sampleAlongPath(straight, 10);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].point.distanceTo(samples[i - 1].point)).toBeCloseTo(10, 6);
    }
  });

  it('keeps spacing across a corner, not per segment', () => {
    /*
      The point of measuring along the road: an L-shaped route must not restart
      its spacing at the bend, or furniture bunches up at every corner.
    */
    const bend = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(25, 0, 0),
      new THREE.Vector3(25, 0, 60)
    ];
    const samples = sampleAlongPath(bend, 10);

    let walked = 0;
    for (let i = 1; i < samples.length; i++) {
      walked = samples[i].point.distanceTo(samples[i - 1].point);
      // Straight-line distance across the corner is slightly under the arc.
      expect(walked).toBeGreaterThan(7);
      expect(walked).toBeLessThanOrEqual(10.001);
    }
    expect(samples.length).toBeGreaterThan(6);
  });

  it('follows a curve rather than cutting the chord', () => {
    // A road that bows out; every sample must sit on it, not on the shortcut.
    const curve: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      curve.push(new THREE.Vector3(t * 200, 0, Math.sin(t * Math.PI) * 40));
    }

    for (const { point } of sampleAlongPath(curve, 15)) {
      // Distance to the straight line z = 0 is how far off-chord it sits.
      const nearest = curve.reduce((best, p) =>
        Math.hypot(p.x - point.x, p.z - point.z) <
        Math.hypot(best.x - point.x, best.z - point.z) ? p : best);
      expect(Math.hypot(nearest.x - point.x, nearest.z - point.z)).toBeLessThan(8);
    }
  });

  it('reports the direction of travel at each sample', () => {
    const samples = sampleAlongPath(straight, 20);
    for (const { tangent } of samples) {
      expect(tangent.length()).toBeCloseTo(1, 6);
      expect(tangent.x).toBeCloseTo(1, 6);
    }
  });

  it('turns the tangent with the road', () => {
    const bend = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(50, 0, 0),
      new THREE.Vector3(50, 0, 50)
    ];
    const samples = sampleAlongPath(bend, 10);
    const first = samples[0].tangent;
    const last = samples[samples.length - 1].tangent;
    expect(Math.abs(first.dot(last))).toBeLessThan(0.01);   // perpendicular
  });

  it('carries the road height, so furniture rides a bridge deck', () => {
    const ramp = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 6, 0)
    ];
    for (const { point } of sampleAlongPath(ramp, 25)) {
      expect(point.y).toBeCloseTo(point.x * 0.06, 6);
    }
  });

  it('never places anything past the end of the road', () => {
    for (const { point } of sampleAlongPath(straight, 7)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
    }
  });

  it('handles degenerate input', () => {
    expect(sampleAlongPath([], 10)).toEqual([]);
    expect(sampleAlongPath([new THREE.Vector3()], 10)).toEqual([]);
    expect(sampleAlongPath(straight, 0)).toEqual([]);
    expect(sampleAlongPath(straight, 500)).toEqual([]);
  });
});

describe('surfaceHeightBeside', () => {
  const z = steepestZ(0);

  it('puts the kerb on the ground when the road is at grade', () => {
    const centre = new THREE.Vector3(0, elevationAt(0, z) + ROAD_SURFACE_Y, z);
    const beside = surfaceHeightBeside(centre, 0, z + 9);
    expect(beside).toBeCloseTo(elevationAt(0, z + 9) + ROAD_SURFACE_Y, 5);
  });

  it('keeps the kerb level with a bridge deck', () => {
    const centre = new THREE.Vector3(0, elevationAt(0, z) + 8, z);
    expect(surfaceHeightBeside(centre, 0, z + 9)).toBeCloseTo(centre.y, 6);
  });
});
