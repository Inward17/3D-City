import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { elevationAt, slopeAt, placeOnGround } from './terrain';
import { STREET_LAMP, STREET_TREE, BENCH } from './scale';

/*
  Street furniture sat at sea level while the ground rose around it, so every
  lamp, tree and bench on a hillside was underground. The ground-aware position
  was computed correctly and then discarded when the instance matrix was built
  — a mistake that only shows up in a render, which is exactly why the
  arithmetic is pulled out here and checked directly.
*/

/** Somewhere with real relief, so "on the ground" is a meaningful claim. */
function slopedPoint(): { x: number; z: number } {
  let best = { slope: 0, x: 0, z: 0 };
  for (let x = -400; x <= 400; x += 20) {
    for (let z = -400; z <= 400; z += 20) {
      const slope = slopeAt(x, z);
      if (slope > best.slope) best = { slope, x, z };
    }
  }
  return { x: best.x, z: best.z };
}

const groundAt = (x: number, z: number) =>
  new THREE.Vector3(x, elevationAt(x, z), z);

describe('placeOnGround', () => {
  const { x, z } = slopedPoint();
  const ground = groundAt(x, z);

  it('stands the item on the ground, not at sea level', () => {
    const placed = placeOnGround(ground, STREET_LAMP.height / 2);
    expect(placed.y).toBeCloseTo(elevationAt(x, z) + STREET_LAMP.height / 2, 6);
  });

  it('keeps the item over its own spot', () => {
    const placed = placeOnGround(ground, 3);
    expect(placed.x).toBe(x);
    expect(placed.z).toBe(z);
  });

  it('treats the offset as a height above ground, not an absolute height', () => {
    // The distinction the bug turned on: indistinguishable on flat ground.
    const high = groundAt(x, z);
    const low = new THREE.Vector3(x, elevationAt(x, z) - 30, z);

    const a = placeOnGround(high, 5);
    const b = placeOnGround(low, 5);
    expect(a.y - b.y).toBeCloseTo(30, 6);
  });

  it('never buries an item that should be above ground', () => {
    for (let sx = -400; sx <= 400; sx += 47) {
      for (let sz = -400; sz <= 400; sz += 47) {
        const placed = placeOnGround(groundAt(sx, sz), BENCH.seatHeight);
        expect(placed.y, `buried at ${sx},${sz}`)
          .toBeGreaterThan(elevationAt(sx, sz));
      }
    }
  });

  it('keeps a lamp head above its own post', () => {
    const post = placeOnGround(ground, STREET_LAMP.height / 2).y;
    const head = placeOnGround(
      ground, STREET_LAMP.height + STREET_LAMP.lanternRadius * 0.5
    ).y;
    expect(head).toBeGreaterThan(post);
  });

  it('keeps a canopy above its own trunk', () => {
    const trunk = placeOnGround(ground, STREET_TREE.trunkHeight / 2).y;
    const canopy = placeOnGround(
      ground, STREET_TREE.trunkHeight + STREET_TREE.canopyRadius * 0.75
    ).y;
    expect(canopy).toBeGreaterThan(trunk);
  });

  it('holds the same shape wherever the ground is', () => {
    // Relative geometry must not drift with elevation.
    const here = placeOnGround(groundAt(200, 200), 4).y - elevationAt(200, 200);
    const there = placeOnGround(groundAt(-350, 80), 4).y - elevationAt(-350, 80);
    expect(here).toBeCloseTo(there, 6);
  });

  it('writes into the vector it is given, for reuse in a render loop', () => {
    const target = new THREE.Vector3();
    const returned = placeOnGround(ground, 2, target);
    expect(returned).toBe(target);
  });
});
