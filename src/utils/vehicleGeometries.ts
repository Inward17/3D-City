import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAR, BUS, TRUCK } from './scale';

/**
 * Vehicle meshes, built to the real dimensions in `scale.ts`.
 *
 * Two conventions matter here:
 *
 *  - **Forward is +X.** The instancing code rotates by `atan2(-dz, dx)` to put
 *    this axis on the travel direction (see vehicleHeading).
 *  - **The origin is at road level**, between the wheels. Geometry is built
 *    upward from y = 0, so an instance placed on the road surface has its tyres
 *    touching it. The previous meshes were centred arbitrarily and then lifted
 *    by half a hard-coded height, which left every vehicle hovering ~2.5 m up.
 *
 * Sizes used to be roughly double reality — a "car" was 8 m long and 4 m wide
 * with 2 m wheels, wider than the lane it drove in.
 */

function applyColorToGeometry(geometry: THREE.BufferGeometry, color: THREE.Color) {
  const colors = [];
  const count = geometry.attributes.position.count;
  for (let i = 0; i < count; i++) {
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

const BODY = new THREE.Color(1, 1, 1);        // tinted per instance
const GLASS = new THREE.Color(0.12, 0.14, 0.18);
const RUBBER = new THREE.Color(0.06, 0.06, 0.07);

/** Four (or six) wheels, axles along Z, sitting on the ground. */
function wheelSet(diameter: number, halfTrack: number, axlePositions: number[]) {
  const r = diameter / 2;
  const wheel = new THREE.CylinderGeometry(r, r, diameter * 0.35, 14);
  // Cylinder is Y-up by default; lay it on its side so it rolls about Z.
  wheel.rotateX(Math.PI / 2);
  applyColorToGeometry(wheel, RUBBER);

  const out: THREE.BufferGeometry[] = [];
  for (const x of axlePositions) {
    out.push(wheel.clone().translate(x, r, halfTrack));
    out.push(wheel.clone().translate(x, r, -halfTrack));
  }
  wheel.dispose();
  return out;
}

export function createCarGeometry(): THREE.BufferGeometry {
  const { length, height, width, wheelDiameter } = CAR;
  const groundClearance = wheelDiameter * 0.45;
  const bodyHeight = height * 0.55;

  const body = new THREE.BoxGeometry(length, bodyHeight, width);
  body.translate(0, groundClearance + bodyHeight / 2, 0);
  applyColorToGeometry(body, BODY);

  // Cabin: shorter, set back slightly, narrower than the body.
  const cabinHeight = height - groundClearance - bodyHeight;
  const cabin = new THREE.BoxGeometry(length * 0.45, cabinHeight, width * 0.88);
  cabin.translate(-length * 0.06, groundClearance + bodyHeight + cabinHeight / 2, 0);
  applyColorToGeometry(cabin, GLASS);

  const wheels = wheelSet(wheelDiameter, width / 2 - wheelDiameter * 0.18, [
    length * 0.3, -length * 0.3
  ]);

  return mergeGeometries([body, cabin, ...wheels])
    || new THREE.BoxGeometry(length, height, width);
}

export function createBusGeometry(): THREE.BufferGeometry {
  const { length, height, width, wheelDiameter } = BUS;
  const floor = wheelDiameter * 0.5;
  const bodyHeight = height - floor;

  const body = new THREE.BoxGeometry(length, bodyHeight, width);
  body.translate(0, floor + bodyHeight / 2, 0);
  applyColorToGeometry(body, BODY);

  // Glazing band along the flanks.
  const glazing = new THREE.BoxGeometry(length * 0.9, bodyHeight * 0.32, width + 0.04);
  glazing.translate(0, floor + bodyHeight * 0.68, 0);
  applyColorToGeometry(glazing, GLASS);

  const wheels = wheelSet(wheelDiameter, width / 2 - wheelDiameter * 0.15, [
    length * 0.34, -length * 0.3
  ]);

  return mergeGeometries([body, glazing, ...wheels])
    || new THREE.BoxGeometry(length, height, width);
}

export function createTruckGeometry(): THREE.BufferGeometry {
  const { length, height, width, wheelDiameter } = TRUCK;
  const chassis = wheelDiameter * 0.6;

  // Cab at the front third.
  const cabHeight = height * 0.62;
  const cab = new THREE.BoxGeometry(length * 0.28, cabHeight, width);
  cab.translate(length * 0.34, chassis + cabHeight / 2, 0);
  applyColorToGeometry(cab, BODY);

  const windscreen = new THREE.BoxGeometry(length * 0.05, cabHeight * 0.4, width * 0.92);
  windscreen.translate(length * 0.47, chassis + cabHeight * 0.72, 0);
  applyColorToGeometry(windscreen, GLASS);

  // Box body behind it, taller than the cab.
  const boxHeight = height - chassis;
  const box = new THREE.BoxGeometry(length * 0.62, boxHeight, width);
  box.translate(-length * 0.16, chassis + boxHeight / 2, 0);
  applyColorToGeometry(box, new THREE.Color(0.88, 0.88, 0.9));

  const wheels = wheelSet(wheelDiameter, width / 2 - wheelDiameter * 0.15, [
    length * 0.36, -length * 0.12, -length * 0.34
  ]);

  return mergeGeometries([cab, windscreen, box, ...wheels])
    || new THREE.BoxGeometry(length, height, width);
}
