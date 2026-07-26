import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  headingFromDirection,
  headingFromVector,
  forwardAxisForHeading
} from './vehicleHeading';

/** The axis the vehicle meshes are modelled along. */
const MODEL_FORWARD = new THREE.Vector3(1, 0, 0);

describe('headingFromDirection', () => {
  it('points the model nose along the direction of travel', () => {
    // This is the whole bug: vehicles were rendered broadside to their motion.
    const directions: [number, number][] = [
      [1, 0], [0, 1], [-1, 0], [0, -1],
      [1, 1], [-3, 7], [5, -2], [-4, -9]
    ];

    for (const [dx, dz] of directions) {
      const angle = headingFromDirection(dx, dz);
      const forward = forwardAxisForHeading(angle);
      const expected = new THREE.Vector3(dx, 0, dz).normalize();

      expect(forward.x, `dx=${dx} dz=${dz}`).toBeCloseTo(expected.x, 6);
      expect(forward.z, `dx=${dx} dz=${dz}`).toBeCloseTo(expected.z, 6);
    }
  });

  it('rejects the old atan2(dx, dz) convention', () => {
    // Travelling along +X, the correct heading is 0. The previous formula gave
    // 90 degrees, which is exactly the sideways-driving symptom.
    const dx = 1, dz = 0;
    expect(headingFromDirection(dx, dz)).toBeCloseTo(0, 6);
    expect(Math.atan2(dx, dz)).toBeCloseTo(Math.PI / 2, 6);
  });

  it('keeps the model axis perpendicular to nothing — forward stays unit length', () => {
    const forward = forwardAxisForHeading(headingFromDirection(3, 4));
    expect(forward.length()).toBeCloseTo(1, 6);
  });

  it('produces opposite headings for opposite directions', () => {
    const a = forwardAxisForHeading(headingFromDirection(1, 2));
    const b = forwardAxisForHeading(headingFromDirection(-1, -2));
    expect(a.dot(b)).toBeCloseTo(-1, 6);
  });

  it('returns 0 rather than NaN for a zero-length direction', () => {
    // getTangentAt should never hand us this, but the old two-point difference
    // could collapse at the end of a curve.
    expect(headingFromDirection(0, 0)).toBe(0);
    expect(Number.isNaN(headingFromDirection(0, 0))).toBe(false);
  });

  it('is unaffected by the magnitude of the direction', () => {
    expect(headingFromDirection(2, 5)).toBeCloseTo(headingFromDirection(200, 500), 9);
  });
});

describe('headingFromVector', () => {
  it('ignores the vertical component', () => {
    const flat = headingFromVector(new THREE.Vector3(1, 0, 1));
    const sloped = headingFromVector(new THREE.Vector3(1, 12, 1));
    expect(flat).toBeCloseTo(sloped, 9);
  });

  it('agrees with a curve tangent', () => {
    // A straight road from origin heading +X: the nose should face +X.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 0)
    ]);
    const forward = forwardAxisForHeading(headingFromVector(curve.getTangentAt(0.5)));
    expect(forward.x).toBeCloseTo(1, 5);
    expect(Math.abs(forward.z)).toBeLessThan(1e-5);
  });

  it('aligns the model forward axis with a diagonal road', () => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(300, 0, 300)
    ]);
    const tangent = curve.getTangentAt(0.5);
    const forward = MODEL_FORWARD.clone().applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      headingFromVector(tangent)
    );
    expect(forward.angleTo(tangent)).toBeCloseTo(0, 5);
  });
});
