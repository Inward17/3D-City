import { useMemo } from 'react';
import { useCityStore } from '../../store/cityStore';
import { Location } from '../../types/city';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';

interface MergedBuildingGeometryProps {
  locations: Location[];
}

// Create a single merged geometry for all building walls
function createMergedBuildingGeometry(locations: Location[]) {
  const buildings = locations.filter(loc => loc.type !== 'Park');
  if (buildings.length === 0) return null;

  const wallGeometries: THREE.BufferGeometry[] = [];
  const roofGeometries: THREE.BufferGeometry[] = [];

  buildings.forEach((location) => {
    const dimensions = getBuildingDimensions(location.type);
    const position = new THREE.Vector3(...location.position);

    // Create wall geometry
    const wallGeometry = new THREE.BoxGeometry(
      dimensions.width,
      dimensions.height,
      dimensions.depth
    );

    // Position the building
    const wallMatrix = new THREE.Matrix4();
    wallMatrix.setPosition(
      position.x,
      position.y + dimensions.height / 2,
      position.z
    );
    wallGeometry.applyMatrix4(wallMatrix);
    wallGeometries.push(wallGeometry);

    // Create roof geometry
    const roofGeometry = new THREE.BoxGeometry(
      dimensions.width + 0.2,
      0.2,
      dimensions.depth + 0.2
    );
    const roofMatrix = new THREE.Matrix4();
    roofMatrix.setPosition(
      position.x,
      position.y + dimensions.height + 0.1,
      position.z
    );
    roofGeometry.applyMatrix4(roofMatrix);
    roofGeometries.push(roofGeometry);
  });

  return {
    walls: mergeBufferGeometries(wallGeometries),
    roofs: mergeBufferGeometries(roofGeometries)
  };
}

function getBuildingDimensions(type: string) {
  switch (type) {
    case 'Building':
      return { width: 20, height: 40, depth: 20 };
    case 'Hospital':
      return { width: 30, height: 30, depth: 30 };
    case 'School':
      return { width: 30, height: 20, depth: 30 };
    case 'Hotel':
      return { width: 20, height: 50, depth: 20 };
    case 'Shop':
    case 'Restaurant':
    case 'Cafe':
      return { width: 20, height: 15, depth: 20 };
    case 'Library':
    case 'Museum':
      return { width: 25, height: 20, depth: 25 };
    default:
      return { width: 20, height: 20, depth: 20 };
  }
}

export function MergedBuildingGeometry({ locations }: MergedBuildingGeometryProps) {
  const { weather } = useCityStore();

  const mergedGeometry = useMemo(() =>
    createMergedBuildingGeometry(locations),
    [locations]);

  // Adjust material based on weather
  const materialProps = useMemo(() => {
    let color = '#60a5fa';
    let roughness = 0.7;
    let metalness = 0.2;

    if (weather === 'rain') {
      roughness = 0.3;
      metalness = 0.6;
    } else if (weather === 'snow') {
      color = '#8bb3e8';
      roughness = 0.8;
      metalness = 0.1;
    }

    return { color, roughness, metalness };
  }, [weather]);

  if (!mergedGeometry) return null;

  return (
    <group>
      {/* Merged building walls - single draw call */}
      <mesh
        geometry={mergedGeometry.walls ?? undefined}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          {...materialProps}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Merged building roofs - single draw call */}
      <mesh
        geometry={mergedGeometry.roofs ?? undefined}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#4a5568"
          roughness={0.8}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}