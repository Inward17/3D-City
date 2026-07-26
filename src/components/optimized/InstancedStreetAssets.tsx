import { useRef, useMemo, useEffect } from 'react';
import { useCityStore } from '../../store/cityStore';
import { Location, Road } from '../../types/city';
import {
  STREET_LAMP, STREET_TREE, BENCH, ROAD_WIDTH, PAVEMENT_WIDTH
} from '../../utils/scale';
import * as THREE from 'three';

interface InstancedStreetAssetsProps {
  locations: Location[];
  roads: Road[];
}

type AssetType = 'streetLamps' | 'trees' | 'benches';

/*
  Street furniture, sized from scale.ts.

  These were previously invented by eye and were wildly out of proportion: a
  30 m street lamp (three storeys, topped with a 3 m glowing ball), and a 12 m
  bench with a 5 m backrest — longer than the bus driving past it. The render
  block also hard-coded its own copies of those dimensions inline, so the
  config above it was dead weight; there is now one source per asset.

  Spacing and kerb offsets are derived from the carriageway width plus pavement
  rather than arbitrary 25-40 m gaps that dropped lamps into neighbouring plots.
*/
const ASSETS: Record<AssetType, {
  spacing: number;
  roadOffset: number;
  /** Height of the primary mesh's centre above ground. */
  primaryY: number;
  /** Height of the secondary mesh's centre, when the asset has one. */
  secondaryY?: number;
}> = {
  streetLamps: {
    spacing: 30,
    roadOffset: ROAD_WIDTH.secondary / 2 + PAVEMENT_WIDTH * 0.5,
    primaryY: STREET_LAMP.height / 2,
    secondaryY: STREET_LAMP.height + STREET_LAMP.lanternRadius * 0.5
  },
  trees: {
    spacing: 18,
    roadOffset: ROAD_WIDTH.secondary / 2 + PAVEMENT_WIDTH * 1.4,
    primaryY: STREET_TREE.trunkHeight / 2,
    secondaryY: STREET_TREE.trunkHeight + STREET_TREE.canopyRadius * 0.75
  },
  benches: {
    spacing: 45,
    roadOffset: ROAD_WIDTH.secondary / 2 + PAVEMENT_WIDTH * 0.6,
    primaryY: BENCH.seatHeight
  }
};

/** Deterministic 0..1 per instance, so furniture doesn't reshuffle on rerender. */
function jitter(i: number, salt: number): number {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// Generate positions along roads
function generateAssetPositions(
  roads: Road[],
  locations: Location[],
  spacing: number,
  offset: number
) {
  const positions: THREE.Vector3[] = [];
  const rotations: number[] = [];

  roads.forEach(road => {
    const from = locations.find(l => l.id === road.from);
    const to = locations.find(l => l.id === road.to);
    if (!from || !to) return;

    const roadLength = Math.sqrt(
      Math.pow(to.position[0] - from.position[0], 2) +
      Math.pow(to.position[2] - from.position[2], 2)
    );

    const itemCount = Math.floor(roadLength / spacing);
    if (itemCount <= 0) return;

    const direction = new THREE.Vector2(
      to.position[0] - from.position[0],
      to.position[2] - from.position[2]
    ).normalize();
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);

    for (let i = 1; i <= itemCount; i++) {
      const t = i / (itemCount + 1);
      const baseX = from.position[0] + (to.position[0] - from.position[0]) * t;
      const baseZ = from.position[2] + (to.position[2] - from.position[2]) * t;

      [1, -1].forEach(side => {
        const finalX = baseX + perpendicular.x * offset * side;
        const finalZ = baseZ + perpendicular.y * offset * side;

        // Keep clear of building footprints. 18 m covers the largest default
        // half-footprint (30 m wide) plus a margin.
        const isClear = locations.every(loc => {
          const dist = Math.sqrt(
            Math.pow(finalX - loc.position[0], 2) +
            Math.pow(finalZ - loc.position[2], 2)
          );
          return dist > 18;
        });

        if (isClear) {
          positions.push(new THREE.Vector3(finalX, 0, finalZ));
          rotations.push(Math.atan2(direction.x, direction.y) + (side > 0 ? 0 : Math.PI));
        }
      });
    }
  });

  return { positions, rotations };
}

function InstancedAsset({
  type,
  positions,
  rotations
}: {
  type: AssetType;
  positions: THREE.Vector3[];
  rotations: number[];
}) {
  const mainMeshRef = useRef<THREE.InstancedMesh>(null);
  const secondaryMeshRef = useRef<THREE.InstancedMesh>(null);
  const { timeOfDay, weather } = useCityStore();

  const isNight = timeOfDay < 6 || timeOfDay > 18;
  const spec = ASSETS[type];
  const hasSecondary = spec.secondaryY !== undefined;

  useEffect(() => {
    if (!mainMeshRef.current) return;

    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    positions.forEach((position, i) => {
      // Geometry is centred on its own origin, so the height offset comes from
      // the spec rather than the old hard-coded +6 / +12 / +32 magic numbers.
      tempPosition.set(position.x, spec.primaryY, position.z);
      tempQuaternion.setFromAxisAngle(up, rotations[i]);
      tempScale.setScalar(0.92 + jitter(i, 1) * 0.16);

      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      mainMeshRef.current!.setMatrixAt(i, tempMatrix);
    });

    mainMeshRef.current.instanceMatrix.needsUpdate = true;
    mainMeshRef.current.count = positions.length;

    if (secondaryMeshRef.current && spec.secondaryY !== undefined) {
      positions.forEach((position, i) => {
        tempPosition.set(position.x, spec.secondaryY!, position.z);
        tempQuaternion.setFromAxisAngle(up, rotations[i]);
        // Canopies vary more than poles; lanterns stay uniform.
        tempScale.setScalar(
          type === 'trees' ? 0.85 + jitter(i, 2) * 0.3 : 1
        );

        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        secondaryMeshRef.current!.setMatrixAt(i, tempMatrix);
      });

      secondaryMeshRef.current.instanceMatrix.needsUpdate = true;
      secondaryMeshRef.current.count = positions.length;
    }
  }, [positions, rotations, type, spec]);

  if (positions.length === 0) return null;

  const primaryMaterial =
    type === 'streetLamps' ? { color: '#4b5058', metalness: 0.7, roughness: 0.35 }
      : type === 'trees' ? { color: '#5a4632', metalness: 0.05, roughness: 0.95 }
        : { color: '#7a5a3a', metalness: 0.05, roughness: 0.85 };

  const canopyColor =
    weather === 'snow' ? '#9fc3a5' : weather === 'rain' ? '#2f6b3a' : '#3f8f52';

  return (
    <group name={`street-${type}`}>
      <instancedMesh
        ref={mainMeshRef}
        args={[undefined, undefined, Math.max(positions.length, 1)]}
        castShadow
        receiveShadow
      >
        {type === 'streetLamps' ? (
          <cylinderGeometry args={[STREET_LAMP.radius * 0.8, STREET_LAMP.radius, STREET_LAMP.height, 8]} />
        ) : type === 'trees' ? (
          <cylinderGeometry args={[STREET_TREE.trunkRadius * 0.8, STREET_TREE.trunkRadius, STREET_TREE.trunkHeight, 8]} />
        ) : (
          <boxGeometry args={[BENCH.length, 0.08, BENCH.depth]} />
        )}
        <meshStandardMaterial {...primaryMaterial} />
      </instancedMesh>

      {hasSecondary && (
        <instancedMesh
          ref={secondaryMeshRef}
          args={[undefined, undefined, Math.max(positions.length, 1)]}
          castShadow
        >
          {type === 'streetLamps' ? (
            <sphereGeometry args={[STREET_LAMP.lanternRadius, 10, 8]} />
          ) : (
            <sphereGeometry args={[STREET_TREE.canopyRadius, 12, 10]} />
          )}
          {type === 'streetLamps' ? (
            <meshStandardMaterial
              color={isNight ? '#ffe9b0' : '#e8e8e8'}
              emissive={isNight ? '#ffcf6e' : '#000000'}
              emissiveIntensity={isNight ? 3 : 0}
              toneMapped={!isNight}
              roughness={0.4}
            />
          ) : (
            <meshStandardMaterial color={canopyColor} roughness={0.9} metalness={0.02} />
          )}
        </instancedMesh>
      )}
    </group>
  );
}

export function InstancedStreetAssets({ locations, roads }: InstancedStreetAssetsProps) {
  const assetData = useMemo(() => {
    const out = {} as Record<AssetType, { positions: THREE.Vector3[]; rotations: number[] }>;
    (Object.keys(ASSETS) as AssetType[]).forEach(type => {
      out[type] = generateAssetPositions(
        roads, locations, ASSETS[type].spacing, ASSETS[type].roadOffset
      );
    });
    return out;
  }, [roads, locations]);

  return (
    <group name="instanced-street-assets">
      {(Object.keys(ASSETS) as AssetType[]).map(type => (
        <InstancedAsset
          key={type}
          type={type}
          positions={assetData[type].positions}
          rotations={assetData[type].rotations}
        />
      ))}
    </group>
  );
}
