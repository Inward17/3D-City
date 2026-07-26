import { useCallback, useMemo, useRef, useState } from 'react';
import { useCityStore } from '../store/cityStore';
import { ThreeEvent } from '@react-three/fiber';
import { Vec3 } from '../types/city';
import * as THREE from 'three';

/** Footprint of the ghost preview, matched to the real building dimensions. */
const PLACEMENT_DIMENSIONS: Partial<Record<string, { w: number; h: number; d: number }>> = {
  Building: { w: 20, h: 40, d: 20 },
  Hospital: { w: 30, h: 30, d: 30 },
  School: { w: 30, h: 20, d: 30 },
  Hotel: { w: 20, h: 50, d: 20 },
  Shop: { w: 20, h: 15, d: 20 },
  Restaurant: { w: 20, h: 15, d: 20 },
  Cafe: { w: 20, h: 15, d: 20 },
  Library: { w: 25, h: 20, d: 25 },
  Museum: { w: 25, h: 20, d: 25 },
  Park: { w: 40, h: 1, d: 40 }
};

/** Snap placement to a grid so hand-placed buildings line up with each other. */
const GRID_STEP = 10;
const snap = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;

export function Terrain() {
  const { isPlacingBuilding, buildingTypeToPlace, addBuilding, showGeoMap } = useCityStore();
  const [ghost, setGhost] = useState<Vec3 | null>(null);
  const placingRef = useRef(false);

  const dims = useMemo(
    () => PLACEMENT_DIMENSIONS[buildingTypeToPlace ?? ''] ?? { w: 20, h: 20, d: 20 },
    [buildingTypeToPlace]
  );

  const handleTerrainClick = useCallback(
    async (event: ThreeEvent<MouseEvent>) => {
      if (!isPlacingBuilding || placingRef.current) return;
      event.stopPropagation();

      const x = snap(event.point.x);
      const z = snap(event.point.z);
      const name = `New ${buildingTypeToPlace ?? 'Building'}`;

      placingRef.current = true;
      setGhost(null);
      try {
        await addBuilding([x, 0, z], name);
      } finally {
        placingRef.current = false;
      }
    },
    [isPlacingBuilding, buildingTypeToPlace, addBuilding]
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
      {/* Ground plane. Also the placement target: it's the only thing under the
          cursor across most of the map, so clicks land here. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleTerrainClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setGhost(null)}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[4000, 4000]} />
        {showGeoMap ? (
          <meshBasicMaterial visible={false} />
        ) : (
          <meshStandardMaterial color="#5b7f5b" roughness={0.95} metalness={0} />
        )}
      </mesh>

      {/* Ground grid, sized to the city rather than the 20km plane the scene
          used to draw. Gives the eye a sense of scale and snap alignment. */}
      {!showGeoMap && (
        <gridHelper
          args={[1600, 160, '#3f5f52', '#46685a']}
          position={[0, 0.05, 0]}
        />
      )}

      {/* Placement ghost */}
      {isPlacingBuilding && ghost && (
        <group position={[ghost[0], 0, ghost[2]]}>
          <mesh position={[0, dims.h / 2, 0]}>
            <boxGeometry args={[dims.w, dims.h, dims.d]} />
            <meshStandardMaterial
              color="#38bdf8"
              transparent
              opacity={0.35}
              emissive="#38bdf8"
              emissiveIntensity={0.4}
              depthWrite={false}
            />
          </mesh>
          {/* Footprint outline on the ground */}
          <lineSegments position={[0, 0.15, 0]}>
            <edgesGeometry
              args={[new THREE.BoxGeometry(dims.w, 0.1, dims.d)]}
            />
            <lineBasicMaterial color="#7dd3fc" />
          </lineSegments>
        </group>
      )}
    </group>
  );
}
