import * as THREE from 'three';
import { elevationAt } from './terrain';
import { ROAD_SURFACE_Y } from './scale';

/**
 * Height of the road surface at a point offset sideways from the centre-line.
 *
 * At grade this is simply the ground under that point, so a kerb, a pavement or
 * a lamp post sits on the hillside rather than on a horizontal plane through
 * the road's middle. On a bridge it stays level with the deck, because a deck
 * is a structure and there is no ground beneath it to follow — the transition
 * fades in over the first metre and a half of the ramp.
 *
 * Shared by the carriageway geometry and by anything placed beside it, so the
 * two cannot drift apart.
 */
export function surfaceHeightBeside(
  centre: THREE.Vector3,
  x: number,
  z: number
): number {
  const groundUnderCentre = elevationAt(centre.x, centre.z);
  const lift = centre.y - groundUnderCentre;
  const follow = Math.max(0, Math.min(1, 1 - (lift - ROAD_SURFACE_Y) / 1.5));

  return centre.y + follow * (elevationAt(x, z) - groundUnderCentre);
}

/** A point along a road, with the direction of travel there. */
export interface PathSample {
  point: THREE.Vector3;
  /** Unit direction in plan. */
  tangent: THREE.Vector2;
}

/**
 * Walk a road at fixed intervals of real distance.
 *
 * Street furniture used to be spaced by interpolating between the two
 * buildings a road connects, which is only the road itself when the road
 * happens to be straight. Anything that bent around a building left its lamps
 * and benches strung across open ground on the chord.
 *
 * @param spacing metres between samples, measured along the road
 */
export function sampleAlongPath(
  path: THREE.Vector3[],
  spacing: number
): PathSample[] {
  if (path.length < 2 || spacing <= 0) return [];

  const samples: PathSample[] = [];
  let distanceToNext = spacing;

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];

    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length === 0) continue;

    const tangent = new THREE.Vector2(dx / length, dz / length);

    let along = distanceToNext;
    while (along <= length) {
      const t = along / length;
      samples.push({
        point: new THREE.Vector3(
          from.x + dx * t,
          from.y + (to.y - from.y) * t,
          from.z + dz * t
        ),
        tangent
      });
      along += spacing;
    }

    distanceToNext = along - length;
  }

  return samples;
}

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
 * @param y      base height, or `null` to use each point's own y — which is how
 *               bridge decks ramp up and over a crossing rather than lying flat
 */
export function createRoadRibbon(
  points: THREE.Vector3[],
  width: number,
  y: number | null
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

    /*
      Both edges used to take the centre-line's height, which makes the
      carriageway a horizontal strip. On a cross-slope the ground tilts under it
      and the road is buried on the uphill side and left in the air on the
      downhill one — up to two thirds of a metre on this terrain, against a
      surface offset of eight centimetres.

      Each edge now takes its own ground height. `lift` fades that out as the
      road climbs a bridge ramp, because a deck really is flat across its width.
    */
    const height = y ?? p.y;

    let leftY = height;
    let rightY = height;

    if (y === null) {
      leftY = surfaceHeightBeside(p, p.x - o.x, p.z - o.z);
      rightY = surfaceHeightBeside(p, p.x + o.x, p.z + o.z);
    }

    positions.push(p.x - o.x, leftY, p.z - o.z);
    positions.push(p.x + o.x, rightY, p.z + o.z);

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
 * A disc or annulus of ground that follows the terrain under it.
 *
 * A park was drawn as a flat 60 m circle sitting at one height. On this ground
 * that misses the real surface by well over a metre at the rim — the lawn cut
 * into the hillside on one side and hung off it on the other.
 *
 * Vertices are returned relative to `baseY`, because the mesh is drawn inside a
 * group already standing at the park's own level.
 *
 * @param inner 0 for a solid disc, or the hole radius for a ring
 */
export function createTerrainDisc(
  centreX: number,
  centreZ: number,
  inner: number,
  outer: number,
  baseY: number,
  segments = 48,
  rings = 6
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  const ringCount = inner > 0 ? 1 : rings;

  for (let r = 0; r <= ringCount; r++) {
    const radius = inner + ((outer - inner) * r) / ringCount;
    for (let s = 0; s <= segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions.push(x, elevationAt(centreX + x, centreZ + z) - baseY, z);
    }
  }

  const perRing = segments + 1;
  for (let r = 0; r < ringCount; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * perRing + s;
      const b = a + perRing;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Dashed centre-line for a road, as short ribbon segments.
 * Returns null when the road is too narrow to be worth marking.
 *
 * @param offset height *above the road surface*, not above sea level. It used
 *   to be an absolute height, which was indistinguishable while the world was
 *   flat and buried every marking the moment the ground had relief.
 */
export function createCentreLine(
  points: THREE.Vector3[],
  offset: number,
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

    // Painted onto the carriageway, so it rides whatever height the road is at.
    a.y += offset;
    b.y += offset;

    const dash = createRoadRibbon([a, b], markingWidth, null);
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
