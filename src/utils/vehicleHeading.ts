import * as THREE from 'three';

/**
 * Y-rotation that points a vehicle along its direction of travel.
 *
 * The vehicle meshes are modelled nose-to-tail along **+X** (see
 * `vehicleGeometries`: the car body is an 8x2x4 box and the axles are separated
 * along X). A rotation of θ about Y maps +X to `(cos θ, 0, -sin θ)`, so to put
 * the model's nose on the travel direction `(dx, _, dz)`:
 *
 *     cos θ =  dx / L
 *     sin θ = -dz / L        =>   θ = atan2(-dz, dx)
 *
 * The bug this replaces used `atan2(dx, dz)`, which is the angle that aligns
 * **+Z** with travel. With a model whose length runs along X, that leaves every
 * vehicle broadside to its motion — visibly sliding down the road sideways.
 *
 * Returns 0 for a degenerate (zero-length) direction rather than NaN.
 */
export function headingFromDirection(dx: number, dz: number): number {
  if (dx === 0 && dz === 0) return 0;
  return Math.atan2(-dz, dx);
}

/** Convenience wrapper for a three.js tangent/direction vector. */
export function headingFromVector(v: THREE.Vector3): number {
  return headingFromDirection(v.x, v.z);
}

/**
 * The world-space forward axis produced by {@link headingFromDirection}.
 * Exists so tests can assert the round trip without duplicating the matrix math.
 */
export function forwardAxisForHeading(angle: number): THREE.Vector3 {
  return new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
}
