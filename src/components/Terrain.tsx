import { useMemo, useCallback } from 'react';
import { useCityStore } from '../store/cityStore';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { ThreeEvent } from '@react-three/fiber';

// Create noise generator
const noise2D = createNoise2D();

// Improved noise function using simplex noise
function improvedNoise(x: number, y: number, scale = 1) {
  return noise2D(x * scale, y * scale);
}

export function Terrain() {
  const { locations, roads, isPlacingBuilding, addBuilding, weather } = useCityStore();
  
  // Generate terrain geometry with road and building flattening
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 200, 256, 256);
    const positions = geo.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      
      // Calculate base terrain elevation
      const elevation = 
        improvedNoise(x, z, 0.02) * 3.0 + // Large features
        improvedNoise(x, z, 0.04) * 1.5 + // Medium features
        improvedNoise(x, z, 0.08) * 0.75 + // Small features
        improvedNoise(x, z, 0.16) * 0.35; // Detail features
      
      // Calculate flattening influence from buildings and roads
      let flatteningFactor = 0;
      
      // Building influence
      locations.forEach(location => {
        const dx = x - location.position[0];
        const dz = z - location.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Adjust flattening radius based on building type
        let flatteningRadius = 8;
        if (location.type === 'School' || location.type === 'Hospital') {
          flatteningRadius = 10;
        } else if (location.type === 'Park') {
          flatteningRadius = 6; // Less flattening for parks
        }
        
        const buildingInfluence = Math.max(0, 1 - distance / flatteningRadius);
        flatteningFactor = Math.max(flatteningFactor, buildingInfluence);
      });
      
      // Road influence with wider flattening
      roads.forEach(road => {
        const from = locations.find(l => l.id === road.from);
        const to = locations.find(l => l.id === road.to);
        if (!from || !to) return;
        
        // Calculate distance to road segment
        const roadVector = new THREE.Vector2(
          to.position[0] - from.position[0],
          to.position[2] - from.position[2]
        );
        const pointVector = new THREE.Vector2(
          x - from.position[0],
          z - from.position[2]
        );
        
        const roadLength = roadVector.length();
        const projection = pointVector.dot(roadVector) / roadLength;
        
        if (projection >= 0 && projection <= roadLength) {
          const distance = Math.abs(
            (to.position[0] - from.position[0]) * (from.position[2] - z) -
            (from.position[0] - x) * (to.position[2] - from.position[2])
          ) / roadLength;
          
          // Wider flattening for main roads
          const roadWidth = road.type === 'main' ? 8 : 
                           road.type === 'secondary' ? 6 : 5;
          const roadInfluence = Math.max(0, 1 - distance / roadWidth);
          flatteningFactor = Math.max(flatteningFactor, roadInfluence);
        }
      });
      
      // Apply elevation with flattening
      positions[i + 1] = elevation * (1 - flatteningFactor);
    }
    
    // Compute normals for proper lighting
    geo.computeVertexNormals();
    return geo;
  }, [locations, roads]);

  const handleTerrainClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!isPlacingBuilding) return;

    // Prevent event from propagating
    event.stopPropagation();
    
    // Get the intersection point in world coordinates
    const point = event.point;
    
    // Generate a name based on the location
    const name = `New Building at (${point.x.toFixed(1)}, ${point.z.toFixed(1)})`;
    
    // Add the building at the clicked position, keeping y at 0 for flat placement
    addBuilding([point.x, 0, point.z], name);
  }, [isPlacingBuilding, addBuilding]);

  // Determine terrain color based on weather
  const getTerrainColor = () => {
    if (weather === 'snow') {
      return {
        color: "#e2e8f0", // Light gray with blue tint for snow
        roughness: 0.9,
        metalness: 0.1
      };
    } else if (weather === 'rain') {
      return {
        color: "#3d7260", // Darker green for wet ground
        roughness: 0.6,
        metalness: 0.3
      };
    } else {
      return {
        color: "#4a9375", // Default green
        roughness: 0.8,
        metalness: 0.2
      };
    }
  };

  const terrainProps = getTerrainColor();

  return (
    <group>
      {/* Main terrain */}
      <mesh 
        geometry={geometry} 
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow 
        castShadow
        onClick={handleTerrainClick}
        position={[0, 0, 0]}
      >
        <meshStandardMaterial
          color={terrainProps.color}
          roughness={terrainProps.roughness}
          metalness={terrainProps.metalness}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Base ground plane (extends beyond terrain) */}
      <mesh 
        position={[0, -0.1, 0]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial
          color={weather === 'snow' ? "#d1d5db" : "#3d7260"}
          roughness={1}
          metalness={0}
          envMapIntensity={0.5}
        />
      </mesh>
    </group>
  );
}