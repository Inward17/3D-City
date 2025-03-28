import { useRef, useMemo } from 'react';
import { Box, Cylinder, Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Location } from '../types/city';
import { useCityStore } from '../store/cityStore';
import * as THREE from 'three';
import seedrandom from 'seedrandom';

interface LocationModelProps {
  location: Location;
  isHovered: boolean;
}

function WindowGrid({ width, height, depth, color }) {
  const timeOfDay = useCityStore(state => state.timeOfDay);
  const isNight = timeOfDay < 6 || timeOfDay > 18;
  
  const windows = [];
  // Increase window density by reducing spacing
  const rows = Math.floor(height / 0.4); // Decreased from 0.8
  const cols = Math.floor(width / 0.3); // Decreased from 0.6
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hourFactor = timeOfDay >= 9 && timeOfDay <= 17 ? 0.8 : 0.4;
      const isLit = isNight ? Math.random() > (row / rows * 0.3 + 0.3) : 
                             Math.random() > (1 - hourFactor);
      
      const windowColor = isLit ? 
        new THREE.Color(0xffd700).lerp(new THREE.Color(0xffaa00), Math.random() * 0.5) : 
        new THREE.Color(color);
      
      windows.push(
        <Box
          key={`window-${row}-${col}`}
          args={[0.2, 0.3, 0.1]} // Decreased window size to fit more
          position={[
            (col - (cols - 1) / 2) * 0.3,
            row * 0.4 + 0.2,
            depth / 2
          ]}
        >
          <meshStandardMaterial
            color={windowColor}
            emissive={isLit ? windowColor : '#000000'}
            emissiveIntensity={isLit ? 1 : 0}
            metalness={0.8}
            roughness={0.2}
            transparent={false}
          />
        </Box>
      );
    }
  }
  
  return <>{windows}</>;
}

function BuildingDecoration({ type, position }) {
  const { weather } = useCityStore();
  const hasSnow = weather === 'snow';
  
  switch (type) {
    case 'antenna':
      return (
        <group position={position}>
          <Cylinder args={[0.05, 0.05, 2]} position={[0, 1, 0]}>
            <meshStandardMaterial color="#666666" />
          </Cylinder>
          <Sphere args={[0.1]} position={[0, 2, 0]}>
            <meshStandardMaterial color="#ff0000" />
          </Sphere>
          
          {/* Snow cap on antenna */}
          {hasSnow && (
            <Sphere args={[0.12]} position={[0, 2.05, 0]}>
              <meshStandardMaterial color="white" />
            </Sphere>
          )}
        </group>
      );
    case 'waterTank':
      return (
        <group position={position}>
          <Cylinder args={[0.3, 0.3, 0.6]} position={[0, 0.3, 0]}>
            <meshStandardMaterial color="#a0a0a0" />
          </Cylinder>
          <Cylinder args={[0.1, 0.1, 0.4]} position={[0, -0.1, 0]}>
            <meshStandardMaterial color="#808080" />
          </Cylinder>
          
          {/* Snow cap on water tank */}
          {hasSnow && (
            <Cylinder args={[0.32, 0.32, 0.05]} position={[0, 0.63, 0]}>
              <meshStandardMaterial color="white" />
            </Cylinder>
          )}
        </group>
      );
    case 'billboard':
      return (
        <group position={position}>
          <Box args={[0.8, 0.5, 0.05]} position={[0, 0.25, 0]}>
            <meshStandardMaterial color="#2563eb" emissive="#2563eb" emissiveIntensity={0.5} />
          </Box>
          <Cylinder args={[0.05, 0.05, 0.5]} position={[0, -0.25, 0]}>
            <meshStandardMaterial color="#666666" />
          </Cylinder>
        </group>
      );
    case 'airConditioner':
      return (
        <group position={position}>
          <Box args={[0.3, 0.2, 0.2]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#a0a0a0" />
          </Box>
          <Cylinder args={[0.08, 0.08, 0.05]} position={[0, 0, 0.15]} rotation={[Math.PI/2, 0, 0]}>
            <meshStandardMaterial color="#808080" />
          </Cylinder>
        </group>
      );
    default:
      return null;
  }
}

function ConstructionZone({ width, height, depth }) {
  const craneRef = useRef();
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (craneRef.current) {
      craneRef.current.rotation.y = Math.sin(time * 0.2) * 0.5;
    }
  });

  return (
    <group>
      {/* Construction base */}
      <Box args={[width, height * 0.7, depth]} position={[0, height * 0.35, 0]}>
        <meshStandardMaterial color="#808080" wireframe />
      </Box>
      
      {/* Scaffolding */}
      <group position={[0, 0, depth/2 + 0.2]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box
            key={`scaffold-${i}`}
            args={[0.1, height * 0.8, 0.1]}
            position={[(i - 2) * 0.5, height * 0.4, 0]}
          >
            <meshStandardMaterial color="#666666" />
          </Box>
        ))}
        
        {/* Horizontal scaffolding */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Box
            key={`horizontal-${i}`}
            args={[width, 0.1, 0.1]}
            position={[0, i * height * 0.3, 0]}
          >
            <meshStandardMaterial color="#666666" />
          </Box>
        ))}
      </group>
      
      {/* Crane */}
      <group ref={craneRef} position={[width/2 + 1, 0, 0]}>
        <Cylinder args={[0.2, 0.2, height]} position={[0, height/2, 0]}>
          <meshStandardMaterial color="#ff9800" />
        </Cylinder>
        <Box args={[3, 0.2, 0.2]} position={[1.5, height, 0]} rotation={[0, 0, 0]}>
          <meshStandardMaterial color="#ff9800" />
        </Box>
        <Box args={[0.2, 1, 0.2]} position={[3, height - 0.5, 0]}>
          <meshStandardMaterial color="#ff9800" />
        </Box>
      </group>
    </group>
  );
}

export function LocationModel({ location, isHovered }: LocationModelProps) {
  const { timeOfDay, weather } = useCityStore();
  const isNight = timeOfDay < 6 || timeOfDay > 18;
  const hasSnow = weather === 'snow';
  
  const dimensions = useMemo(() => {
    switch (location.type) {
      case 'Building':
        return { width: 2 + Math.random() * 0.5, height: 4 + Math.random() * 2, depth: 2 + Math.random() * 0.5 };
      case 'Park':
        return { width: 4, height: 0.1, depth: 4 };
      case 'Museum':
        return { width: 3, height: 2, depth: 3 };
      case 'Restaurant':
        return { width: 2, height: 1.5, depth: 2 };
      case 'Shop':
        return { width: 2, height: 1.5, depth: 2 };
      case 'School':
        return { width: 3, height: 2, depth: 3 };
      case 'Hospital':
        return { width: 3, height: 3, depth: 3 };
      case 'Library':
        return { width: 2.5, height: 2, depth: 2.5 };
      case 'Cafe':
        return { width: 1.5, height: 1.2, depth: 1.5 };
      case 'Hotel':
        return { width: 2, height: 5, depth: 2 };
      default:
        return { width: 2, height: 2, depth: 2 };
    }
  }, [location.type]);
  
  const color = useMemo(() => {
    const baseColor = location.color || '#60a5fa';
    
    if (weather === 'rain') {
      return new THREE.Color(baseColor).multiplyScalar(0.8).getStyle();
    } else if (weather === 'snow') {
      return new THREE.Color(baseColor).lerp(new THREE.Color('#ffffff'), 0.3).getStyle();
    }
    
    return baseColor;
  }, [location.color, weather]);
  
  const decorations = useMemo(() => {
    const result = [];
    
    if (location.type === 'Building' || location.type === 'Hotel') {
      if (Math.random() > 0.5) {
        result.push({
          type: 'antenna',
          position: [0, dimensions.height, 0]
        });
      } else {
        result.push({
          type: 'waterTank',
          position: [dimensions.width * 0.3 - dimensions.width/2, dimensions.height, dimensions.depth * 0.3 - dimensions.depth/2]
        });
      }
    }
    
    if (location.type === 'Shop' || location.type === 'Restaurant' || location.type === 'Cafe') {
      result.push({
        type: 'billboard',
        position: [0, dimensions.height + 0.5, 0]
      });
    }
    
    if (location.type !== 'Park') {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        result.push({
          type: 'airConditioner',
          position: [
            (Math.random() - 0.5) * dimensions.width,
            Math.random() * dimensions.height * 0.7,
            dimensions.depth/2 + 0.1
          ]
        });
      }
    }
    
    return result;
  }, [location.type, dimensions]);
  
  const hoverRef = useRef();
  
  useFrame(() => {
    if (hoverRef.current) {
      if (isHovered) {
        hoverRef.current.position.y = Math.sin(Date.now() * 0.003) * 0.1 + 0.1;
      } else {
        hoverRef.current.position.y = 0;
      }
    }
  });

  const isUnderConstruction = useMemo(() => {
    const seed = location.id.charCodeAt(0) + location.id.charCodeAt(location.id.length - 1);
    const rng = seedrandom(seed.toString());
    return rng() < 0.1;
  }, [location.id]);

  if (location.type === 'Park') {
    return (
      <group ref={hoverRef}>
        <Box 
          args={[dimensions.width, dimensions.height, dimensions.depth]} 
          position={[0, dimensions.height/2, 0]}
        >
          <meshStandardMaterial color="#4ade80" transparent={false} />
        </Box>
        
        <Sphere args={[0.8]} position={[-1, 0.8, -1]}>
          <meshStandardMaterial color="#22c55e" transparent={false} />
        </Sphere>
        <Sphere args={[0.6]} position={[1, 0.6, 1]}>
          <meshStandardMaterial color="#22c55e" transparent={false} />
        </Sphere>
        <Sphere args={[0.7]} position={[0.5, 0.7, -0.8]}>
          <meshStandardMaterial color="#22c55e" transparent={false} />
        </Sphere>
        
        <Box args={[dimensions.width * 0.8, 0.05, 0.4]} position={[0, 0.05, 0]} rotation={[0, Math.PI/4, 0]}>
          <meshStandardMaterial color="#d6d3d1" transparent={false} />
        </Box>
        <Box args={[dimensions.width * 0.8, 0.05, 0.4]} position={[0, 0.05, 0]} rotation={[0, -Math.PI/4, 0]}>
          <meshStandardMaterial color="#d6d3d1" transparent={false} />
        </Box>
        
        {hasSnow && (
          <Box 
            args={[dimensions.width, 0.05, dimensions.depth]} 
            position={[0, dimensions.height + 0.025, 0]}
          >
            <meshStandardMaterial color="white" transparent opacity={0.8} />
          </Box>
        )}
        
        {isHovered && (
          <Box 
            args={[dimensions.width + 0.1, dimensions.height + 0.1, dimensions.depth + 0.1]} 
            position={[0, dimensions.height/2, 0]}
          >
            <meshStandardMaterial color="#4ade80" transparent opacity={0.3} />
          </Box>
        )}
      </group>
    );
  }

  return (
    <group ref={hoverRef}>
      {isUnderConstruction ? (
        <ConstructionZone 
          width={dimensions.width} 
          height={dimensions.height} 
          depth={dimensions.depth} 
        />
      ) : (
        <>
          <Box 
            args={[dimensions.width, dimensions.height, dimensions.depth]} 
            position={[0, dimensions.height/2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial 
              color={color} 
              metalness={0.2} 
              roughness={0.8}
              transparent={false}
            />
          </Box>
          
          {location.type !== 'Park' && (
            <>
              <WindowGrid 
                width={dimensions.width} 
                height={dimensions.height} 
                depth={dimensions.depth} 
                color={color}
              />
              
              <group rotation={[0, Math.PI/2, 0]}>
                <WindowGrid 
                  width={dimensions.depth} 
                  height={dimensions.height} 
                  depth={dimensions.width} 
                  color={color}
                />
              </group>
            </>
          )}
          
          {decorations.map((decoration, index) => (
            <BuildingDecoration 
              key={`decoration-${index}`} 
              type={decoration.type} 
              position={decoration.position} 
            />
          ))}
          
          {hasSnow && (
            <Box 
              args={[dimensions.width, 0.1, dimensions.depth]} 
              position={[0, dimensions.height + 0.05, 0]}
            >
              <meshStandardMaterial color="white" transparent={false} />
            </Box>
          )}
        </>
      )}
      
      {isHovered && (
        <Box 
          args={[dimensions.width + 0.2, dimensions.height + 0.2, dimensions.depth + 0.2]} 
          position={[0, dimensions.height/2, 0]}
        >
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.3} />
        </Box>
      )}
      
      {isHovered && (
        <group position={[0, dimensions.height + 0.5, 0]}>
          <Box args={[dimensions.width, 0.3, 0.05]} position={[0, 0, 0]}>
            <meshBasicMaterial color="#1e3a8a" transparent={false} />
          </Box>
        </group>
      )}
    </group>
  );
}