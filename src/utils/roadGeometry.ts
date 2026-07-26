import * as THREE from 'three';

/**
 * Build a flat road ribbon in the XZ plane.
 *
 * Roads were previously drawn with drei's `<Line>`, whose `lineWidth` is in
 * **screen pixels** unless `worldUnits` is set — so a "2.5 wide" main road was
 * 2.5 px on screen at every zoom level, never a carriageway. This emits real
 * geometry instead: a strip of quads centred on the path, `width` metres across,
 * lying flat on the ground so it reads as tarmac from any angle.
 *
 * @param points centre-line of the road, already in world space
 * @param width  carriageway width in metres
 * @param y      height to place the surface at
 */
export function createRoadRibbon(
  points: THREE.Vector3[],
  width: number,
  y: number
): THREE.BufferGeometry | null {
  if (points.length < 2) return null;

  const half = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Perpendicular offset for each vertex, averaged between adjacent segments so
  // corners join without a visible notch.
  const offsets: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];

    const dir = new THREE.Vector3().subVectors(next, prev);
    dir.y = 0;
    if (dir.lengthSq() === 0) dir.set(1, 0, 0);
    dir.normalize();

    // Left-hand normal in the ground plane.
    offsets.push(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(half));
  }

  let travelled = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const o = offsets[i];

    positions.push(p.x - o.x, y, p.z - o.z);
    positions.push(p.x + o.x, y, p.z + o.z);

    if (i > 0) travelled += points[i].distanceTo(points[i - 1]);
    // V runs along the road in metres so any future texture tiles at real scale.
    uvs.push(0, travelled, 1, travelled);

    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Dashed centre-line for a road, as short ribbon segments.
 * Returns null when the road is too narrow to be worth marking.
 */
export function createCentreLine(
  points: THREE.Vector3[],
  y: number,
  dashLength = 3,
  gapLength = 4,
  markingWidth = 0.15
): THREE.BufferGeometry | null {
  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  const total = curve.getLength();
  if (total < dashLength * 2) return null;

  const segments: THREE.BufferGeometry[] = [];
  const stride = dashLength + gapLength;

  for (let d = gapLength; d + dashLength < total; d += stride) {
    const a = curve.getPointAt(d / total);
    const b = curve.getPointAt((d + dashLength) / total);
    const dash = createRoadRibbon([a, b], markingWidth, y);
    if (dash) segments.push(dash);
  }

  if (segments.length === 0) return null;

  // Merge manually: all segments share the same attribute layout.
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const seg of segments) {
    const pos = seg.getAttribute('position');
    const uv = seg.getAttribute('uv');
    const idx = seg.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + vertexOffset);
    }
    vertexOffset += pos.count;
    seg.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}
