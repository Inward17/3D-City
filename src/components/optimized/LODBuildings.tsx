import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useCityStore } from '../../store/cityStore';
import { Location } from '../../types/city';
import * as THREE from 'three';

interface LODBuildingsProps {
  locations: Location[];
}

function LODBuilding({ location }: { location: Location }) {
  const groupRef = useRef<THREE.Group>(null);
  const lodRef = useRef<THREE.LOD | null>(null);
  const { selectedLocation } = useCityStore();
  const { camera } = useThree();
  const hoverStateRef = useRef(false);

  const isSelected = selectedLocation?.id === location.id;

  const dimensions = useMemo(() => {
    switch (location.type) {
      case 'Building':
        return { width: 20, height: 40, depth: 20 };
      case 'Hospital':
        return { width: 30, height: 30, depth: 30 };
      case 'School':
        return { width: 30, height: 20, depth: 30 };
      case 'Hotel':
        return { width: 20, height: 50, depth: 20 };
      default:
        return { width: 20, height: 20, depth: 20 };
    }
  }, [location.type]);

  const buildingColor = useMemo(() => {
    if (isSelected) return '#3b82f6';
    if (hoverStateRef.current) return '#60a5fa';
    return location.color || '#64748b';
  }, [isSelected, location.color]);

  useEffect(() => {
    if (!groupRef.current) return;

    // Captured now so cleanup detaches from the same group this effect added to,
    // not whatever groupRef points at by the time cleanup runs.
    const group = groupRef.current;
    const lod = new THREE.LOD();
    lodRef.current = lod;

    // High detail mesh (< 20 units from camera)
    const highDetailGeometry = new THREE.BoxGeometry(
      dimensions.width,
      dimensions.height,
      dimensions.depth
    );
    const highDetailMesh = new THREE.Mesh(
      highDetailGeometry,
      new THREE.MeshStandardMaterial({
        color: buildingColor,
        metalness: 0.3,
        roughness: 0.7
      })
    );
    highDetailMesh.position.y = dimensions.height / 2;
    highDetailMesh.castShadow = true;
    highDetailMesh.receiveShadow = true;
    lod.addLevel(highDetailMesh, 0);

    // Low detail mesh (> 20 units from camera)
    const lowDetailGeometry = new THREE.BoxGeometry(
      dimensions.width,
      dimensions.height,
      dimensions.depth
    );
    const lowDetailMesh = new THREE.Mesh(
      lowDetailGeometry,
      new THREE.MeshBasicMaterial({ color: buildingColor })
    );
    lowDetailMesh.position.y = dimensions.height / 2;
    lod.addLevel(lowDetailMesh, 200);

    group.add(lod);

    return () => {
      group.remove(lod);
      highDetailGeometry.dispose();
      lowDetailGeometry.dispose();
    };
  }, [dimensions, buildingColor]);

  useFrame((state) => {
    if (lodRef.current && groupRef.current) {
      if (isSelected) {
        const time = state.clock.getElapsedTime();
        groupRef.current.position.y = Math.sin(time * 3) * 0.1;
      } else {
        groupRef.current.position.y = 0;
      }

      // LOD.update() measures the camera distance itself; doing it here as well
      // just allocated a Vector3 per building per frame.
      lodRef.current.update(camera);
    }
  });

  const handlePointerOver = () => {
    hoverStateRef.current = true;
  };

  const handlePointerOut = () => {
    hoverStateRef.current = false;
  };

  return (
    <group
      ref={groupRef}
      position={location.position as [number, number, number]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Selection highlight - only render when selected */}
      {isSelected && (
        <mesh position={[0, 1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[dimensions.width + 5, dimensions.width + 8, 32]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

export function LODBuildings({ locations }: LODBuildingsProps) {
  const buildings = useMemo(() =>
    locations.filter(loc => loc.type !== 'Park'),
    [locations]);

  return (
    <>
      {buildings.map((location) => (
        <LODBuilding key={location.id} location={location} />
      ))}
    </>
  );
}
