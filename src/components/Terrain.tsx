import { useCallback, useMemo, useRef, useState } from 'react';
import { useCityStore } from '../store/cityStore';
import { ThreeEvent } from '@react-three/fiber';
import { Vec3 } from '../types/city';
import { getBuildingDimensions } from '../utils/buildingDimensions';
import { isPlacementClear, MIN_BUILDING_GAP } from '../utils/buildingCollision';
import * as THREE from 'three';
import {
  elevationAt, groundLevelFor, raycastTerrain, hillshadeAt, slopeAt, TERRAIN_RELIEF
} from '../utils/terrain';

/** How far the ground reaches, in metres. */
const GROUND_EXTENT = 4000;

/*
  10 m between samples rather than the roads' 8 m.

  The ground has to reach far enough that its edge is lost in the fog — at a
  1200 m half-extent the square rim was only about half fogged and stood out
  against the sky from any low angle. Reaching 2000 m at 8 m spacing would cost
  half a million triangles, so the sampling is relaxed just far enough to keep
  the count sane while staying finer than the road surface offset: the chord
  between two samples sags well under the 8 cm a road sits above the ground, so
  no carriageway sinks into a hillside.
*/
const GROUND_SAMPLE = 10;
const GROUND_SEGMENTS = Math.round(GROUND_EXTENT / GROUND_SAMPLE);

/** Snap placement to a grid so hand-placed buildings line up with each other. */
const GRID_STEP = 10;
const snap = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;

/**
 * The ground, built once for the life of the page.
 *
 * Deliberately module-level rather than a `useMemo` with a disposing cleanup.
 * StrictMode mounts a component, tears it down and mounts it again, but only
 * re-runs *effects* — a memo survives. So the cleanup disposed this geometry
 * while the mesh went on using it, which is a fine way to break the renderer in
 * development and nowhere else. It is a fixed, static asset; it has no reason
 * to belong to a component instance at all.
 */
let cachedGround: THREE.BufferGeometry | null = null;

function groundGeometry(): THREE.BufferGeometry {
  if (cachedGround) return cachedGround;

  const geometry = new THREE.PlaneGeometry(
    GROUND_EXTENT, GROUND_EXTENT, GROUND_SEGMENTS, GROUND_SEGMENTS
  );
  const position = geometry.attributes.position;
  const colours = new Float32Array(position.count * 3);

  const valley = new THREE.Color('#4d7350');
  const upland = new THREE.Color('#8a8f63');
  const shade = new THREE.Color();

  // The plane is rotated flat by the mesh, so its local Y is world -Z and its
  // local Z is world up.
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = -position.getY(i);
    const height = elevationAt(x, z);
    position.setZ(i, height);

    /*
      Height tint plus a baked hillshade. The scene's own sun cannot be relied
      on to reveal the landform: at the default site it stands 89° up at noon,
      lighting every slope equally, and the ground read as a flat green sheet
      however far it was actually displaced.
    */
    const t = Math.min(1, Math.max(0, height / TERRAIN_RELIEF + 0.5));
    shade.copy(valley).lerp(upland, t);
    shade.multiplyScalar(0.6 + 0.75 * hillshadeAt(x, z));

    /*
      Contour bands every five metres of elevation, the way a planning map
      draws ground. Shading alone still read as a flat colour wash from
      directly above — the aerial view is this app's main view, and contours
      are the one encoding of height that is unambiguous from it.

      The band is widened where the ground is flatter (a contour on a plateau
      is broad, on a scarp it is tight), which is also what stops near-level
      ground dissolving into aliased speckle.
    */
    const interval = 5;
    const distanceToContour =
      Math.abs(((height % interval) + interval) % interval - interval / 2);
    const bandWidth = 0.35 + Math.min(0.4, slopeAt(x, z) * 3);
    if (interval / 2 - distanceToContour < bandWidth) {
      shade.multiplyScalar(0.82);
    }

    colours[i * 3] = shade.r;
    colours[i * 3 + 1] = shade.g;
    colours[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();

  cachedGround = geometry;
  return geometry;
}

/**
 * Pick against the height function instead of the mesh.
 *
 * three.js raycasting scans every triangle, and this one has 180,000 of them.
 * With a pointer handler attached that ran on every mouse move and cost about
 * 11 ms — most of a frame — which is what made the view stutter. Solving the
 * ray against the surface is a few dozen samples instead.
 *
 * Declared as a function rather than an arrow because three.js calls it as a
 * method, and the intersection has to report the mesh as `this`.
 */
function raycastGround(
  this: THREE.Object3D,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[]
) {
  const hit = raycastTerrain(raycaster.ray.origin, raycaster.ray.direction);
  if (!hit) return;

  const point = new THREE.Vector3(hit.x, hit.y, hit.z);
  intersects.push({
    distance: raycaster.ray.origin.distanceTo(point),
    point,
    object: this
  });
}

export function Terrain() {
  const { isPlacingBuilding, buildingTypeToPlace, addBuilding, showGeoMap, locations } =
    useCityStore();
  const [ghost, setGhost] = useState<Vec3 | null>(null);
  const placingRef = useRef(false);

  const ground = useMemo(() => groundGeometry(), []);

  // Shared table rather than a local copy — this component used to carry its
  // own duplicate of the footprint sizes, which drifted from the real ones.
  const dims = useMemo(() => {
    const d = getBuildingDimensions(buildingTypeToPlace ?? 'Building');
    return { w: d.width, h: d.height, d: d.depth };
  }, [buildingTypeToPlace]);

  /** Does the ghost currently sit clear of every existing building? */
  const ghostIsValid = useMemo(() => {
    if (!ghost || !buildingTypeToPlace) return true;
    return isPlacementClear(ghost, buildingTypeToPlace, locations);
  }, [ghost, buildingTypeToPlace, locations]);

  const handleTerrainClick = useCallback(
    async (event: ThreeEvent<MouseEvent>) => {
      if (!isPlacingBuilding || placingRef.current) return;
      event.stopPropagation();

      // `point` comes from the analytic raycast above, so it is already on the
      // visible ground rather than on a flat plane through it.
      const x = snap(event.point.x);
      const z = snap(event.point.z);

      // Clicking an occupied spot does nothing; the ghost has already shown it
      // as invalid, so silently ignoring is less jarring than an error.
      if (buildingTypeToPlace && !isPlacementClear([x, 0, z], buildingTypeToPlace, locations)) {
        return;
      }

      const name = `New ${buildingTypeToPlace ?? 'Building'}`;

      placingRef.current = true;
      setGhost(null);
      try {
        await addBuilding([x, 0, z], name);
      } finally {
        placingRef.current = false;
      }
    },
    [isPlacingBuilding, buildingTypeToPlace, addBuilding, locations]
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isPlacingBuilding) {
        if (ghost) setGhost(null);
        return;
      }
      setGhost([snap(event.point.x), 0, snap(event.point.z)]);
    },
    [isPlacingBuilding, ghost]
  );

  return (
    <group>
      {/* Ground. Also the placement target: it's the only thing under the
          cursor across most of the map, so clicks land here. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        geometry={ground}
        raycast={raycastGround}
        onClick={handleTerrainClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setGhost(null)}
        receiveShadow
        // The geometry is shared and outlives this component; R3F must not
        // dispose it when the view unmounts.
        dispose={null}
      >
        {showGeoMap ? (
          <meshBasicMaterial visible={false} />
        ) : (
          <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
        )}
      </mesh>

      {/* Placement ghost. Red means the footprint would overlap a neighbour, so
          the click will be ignored. */}
      {isPlacingBuilding && ghost && (
        <group position={[
          ghost[0],
          groundLevelFor({ position: ghost, design: { width: dims.w, depth: dims.d } }),
          ghost[2]
        ]}>
          <mesh position={[0, dims.h / 2, 0]}>
            <boxGeometry args={[dims.w, dims.h, dims.d]} />
            <meshStandardMaterial
              color={ghostIsValid ? '#38bdf8' : '#f87171'}
              transparent
              opacity={0.35}
              emissive={ghostIsValid ? '#38bdf8' : '#ef4444'}
              emissiveIntensity={0.4}
              depthWrite={false}
            />
          </mesh>
          {/* Footprint outline on the ground */}
          <lineSegments position={[0, 0.15, 0]}>
            <edgesGeometry
              args={[new THREE.BoxGeometry(dims.w, 0.1, dims.d)]}
            />
            <lineBasicMaterial color={ghostIsValid ? '#7dd3fc' : '#fca5a5'} />
          </lineSegments>

          {/* Required clearance ring, so it's obvious why a spot is refused. */}
          {!ghostIsValid && (
            <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry
                args={[
                  Math.max(dims.w, dims.d) / 2 + MIN_BUILDING_GAP - 1,
                  Math.max(dims.w, dims.d) / 2 + MIN_BUILDING_GAP,
                  40
                ]}
              />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.7} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}
