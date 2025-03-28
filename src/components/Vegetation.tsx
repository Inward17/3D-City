import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Cylinder, Instance, Instances } from '@react-three/drei';
import { useCityStore } from '../store/cityStore';
import * as THREE from 'three';

function Tree({ position, scale = 1, type = 'normal' }) {
  const treeRef = useRef();
  const { weather, timeOfDay } = useCityStore();
  
  // Determine wind intensity based on weather
  const windIntensity = weather === 'rain' ? 0.15 : 
                       weather === 'snow' ? 0.08 : 0.05;
  
  useFrame((state) => {
    // Enhanced swaying motion based on weather
    const time = state.clock.getElapsedTime();
    
    // Base movement
    const baseMovement = Math.sin(time + position[0]) * windIntensity;
    
    // Add gusts of wind
    const gustFrequency = 0.2;
    const gustStrength = weather === 'rain' ? 0.1 : 0.05;
    const gust = Math.sin(time * gustFrequency) * gustStrength;
    
    // Apply movement
    treeRef.current.rotation.x = baseMovement + gust;
    treeRef.current.rotation.z = Math.cos(time + position[2]) * windIntensity + gust;
  });

  // Different tree types
  if (type === 'pine') {
    return (
      <group ref={treeRef} position={position} scale={scale}>
        {/* Tree trunk */}
        <Cylinder args={[0.1, 0.15, 1.2]} position={[0, 0.6, 0]}>
          <meshStandardMaterial color="#5d4037" />
        </Cylinder>
        {/* Pine tree layers */}
        <Cylinder args={[0, 0.6, 1]} position={[0, 1.5, 0]}>
          <meshStandardMaterial color="#2d3e50" />
        </Cylinder>
        <Cylinder args={[0, 0.5, 0.8]} position={[0, 2, 0]}>
          <meshStandardMaterial color="#2d3e50" />
        </Cylinder>
        <Cylinder args={[0, 0.3, 0.6]} position={[0, 2.4, 0]}>
          <meshStandardMaterial color="#2d3e50" />
        </Cylinder>
      </group>
    );
  }
  
  if (type === 'palm') {
    return (
      <group ref={treeRef} position={position} scale={scale}>
        {/* Palm trunk */}
        <Cylinder args={[0.08, 0.12, 1.5]} position={[0, 0.75, 0]}>
          <meshStandardMaterial color="#8d6e63" />
        </Cylinder>
        {/* Palm leaves */}
        {Array.from({ length: 7 }).map((_, i) => {
          const angle = (i / 7) * Math.PI * 2;
          const x = Math.cos(angle) * 0.5;
          const z = Math.sin(angle) * 0.5;
          return (
            <group key={i} position={[x * 0.3, 1.5, z * 0.3]} rotation={[0.3, angle, 0.4]}>
              <Cylinder args={[0.02, 0.02, 1]} position={[0, 0.5, 0]}>
                <meshStandardMaterial color="#4caf50" />
              </Cylinder>
            </group>
          );
        })}
      </group>
    );
  }
  
  // Default tree (deciduous)
  return (
    <group ref={treeRef} position={position} scale={scale}>
      {/* Tree trunk */}
      <Cylinder args={[0.1, 0.2, 1]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="#4a3728" />
      </Cylinder>
      {/* Tree foliage */}
      <Sphere args={[0.5]} position={[0, 1.2, 0]}>
        <meshStandardMaterial color="#2d5a27" />
      </Sphere>
      <Sphere args={[0.4]} position={[0.2, 1, 0.2]}>
        <meshStandardMaterial color="#2d5a27" />
      </Sphere>
      <Sphere args={[0.4]} position={[-0.2, 1, -0.2]}>
        <meshStandardMaterial color="#2d5a27" />
      </Sphere>
    </group>
  );
}

function Grass({ position }) {
  const grassRef = useRef();
  const { weather } = useCityStore();
  
  // Determine wind intensity based on weather
  const windIntensity = weather === 'rain' ? 0.25 : 
                       weather === 'snow' ? 0.1 : 0.15;
  
  useFrame((state) => {
    // Enhanced grass movement based on weather
    const time = state.clock.getElapsedTime();
    
    // Base movement
    const baseMovement = Math.sin(time * 2 + position[0]) * windIntensity;
    
    // Add gusts of wind
    const gustFrequency = 0.5;
    const gustStrength = weather === 'rain' ? 0.15 : 0.08;
    const gust = Math.sin(time * gustFrequency) * gustStrength;
    
    // Apply movement
    grassRef.current.rotation.x = baseMovement + gust;
    grassRef.current.rotation.z = Math.cos(time * 2 + position[2]) * windIntensity + gust;
  });

  return <Instance ref={grassRef} position={position} />;
}

// Improved collision detection with roads and buildings
function isNearStructure(point: [number, number, number], roads: any[], locations: any[], minDistance: number): boolean {
  // Check distance to buildings with improved accuracy
  for (const location of locations) {
    const dx = point[0] - location.position[0];
    const dz = point[2] - location.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // Adjust distance based on building type
    let buildingSize = 1;
    if (location.type === 'School' || location.type === 'Hospital') buildingSize = 2;
    if (location.type === 'Hotel') buildingSize = 1.5;
    
    if (distance < minDistance + buildingSize) return true;
  }

  // Check distance to roads with improved accuracy
  for (const road of roads) {
    const from = locations.find(l => l.id === road.from);
    const to = locations.find(l => l.id === road.to);
    if (!from || !to) continue;

    // Calculate distance to road segment
    const roadVector = new THREE.Vector2(
      to.position[0] - from.position[0],
      to.position[2] - from.position[2]
    );
    const pointVector = new THREE.Vector2(
      point[0] - from.position[0],
      point[2] - from.position[2]
    );
    
    const roadLength = roadVector.length();
    const projection = pointVector.dot(roadVector) / roadLength;
    
    if (projection >= 0 && projection <= roadLength) {
      const distance = Math.abs(
        (to.position[0] - from.position[0]) * (from.position[2] - point[2]) -
        (from.position[0] - point[0]) * (to.position[2] - from.position[2])
      ) / roadLength;
      
      // Adjust distance based on road type
      const roadWidth = road.type === 'main' ? 3 : 
                       road.type === 'secondary' ? 2 : 1.5;
      
      if (distance < minDistance + roadWidth) return true;
    }
  }

  return false;
}

// Function to determine terrain type based on position
function getTerrainType(x: number, z: number): string {
  // Use simplex noise to create biomes
  const biomeScale = 0.02;
  const biomeValue = Math.sin(x * biomeScale) * Math.cos(z * biomeScale);
  
  if (biomeValue > 0.7) return 'pine';
  if (biomeValue < -0.7) return 'palm';
  return 'normal';
}

export function Vegetation() {
  const { locations, roads, weather } = useCityStore();
  
  const vegetationData = useMemo(() => {
    const data = {
      trees: [],
      grass: []
    };
    
    // Generate vegetation around parks and suitable areas
    locations.forEach(location => {
      const radius = location.type === 'Park' ? 15 : 8;
      const density = location.type === 'Park' ? 80 : 20;
      
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * radius;
        
        const x = location.position[0] + Math.cos(angle) * distance;
        const z = location.position[2] + Math.sin(angle) * distance;
        
        const point: [number, number, number] = [x, 0, z];
        
        // Check if the point is near any road or building
        if (!isNearStructure(point, roads, locations, location.type === 'Park' ? 3 : 5)) {
          if (Math.random() < 0.3) {
            data.trees.push({
              position: point,
              scale: 0.8 + Math.random() * 0.4,
              type: getTerrainType(x, z)
            });
          } else {
            data.grass.push(point);
          }
        }
      }
    });
    
    // Add additional vegetation in suitable areas
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      const point: [number, number, number] = [x, 0, z];
      
      if (!isNearStructure(point, roads, locations, 5)) {
        if (Math.random() < 0.2) {
          data.trees.push({
            position: point,
            scale: 0.6 + Math.random() * 0.3,
            type: getTerrainType(x, z)
          });
        } else {
          data.grass.push(point);
        }
      }
    }
    
    return data;
  }, [locations, roads]);

  // Adjust grass color based on weather
  const grassColor = weather === 'snow' ? "#a5d6a7" : // Lighter green under snow
                    weather === 'rain' ? "#2e7d32" : // Darker green when wet
                    "#3a5a40"; // Default green

  return (
    <>
      {/* Trees */}
      {vegetationData.trees.map((tree, i) => (
        <Tree key={`tree-${i}`} {...tree} />
      ))}
      
      {/* Instanced grass */}
      <Instances limit={1000}>
        <cylinderGeometry args={[0.05, 0, 0.3]} />
        <meshStandardMaterial color={grassColor} />
        {vegetationData.grass.map((position, i) => (
          <Grass key={`grass-${i}`} position={position} />
        ))}
      </Instances>
    </>
  );
}