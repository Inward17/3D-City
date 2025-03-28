import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Box, Cylinder } from '@react-three/drei';
import { useCityStore } from '../store/cityStore';
import * as THREE from 'three';

const vehicleTypes = {
  car: {
    dimensions: [0.8, 0.4, 0.4],
    colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
    speedRange: [0.08, 0.12]
  },
  bus: {
    dimensions: [1.2, 0.6, 0.4],
    colors: ['#4a90e2', '#f5a623', '#7ed321'],
    speedRange: [0.06, 0.08]
  },
  truck: {
    dimensions: [1.0, 0.5, 0.4],
    colors: ['#8b572a', '#9013fe', '#417505'],
    speedRange: [0.05, 0.07]
  }
};

function Vehicle({ path, type = 'car', initialDelay = 0 }) {
  const ref = useRef();
  const startTime = useRef(Math.random() * 100000);
  const vehicleType = vehicleTypes[type];
  const color = useMemo(() => {
    const colors = vehicleType.colors;
    return colors[Math.floor(Math.random() * colors.length)];
  }, [vehicleType]);
  const speed = useMemo(() => {
    const [min, max] = vehicleType.speedRange;
    return min + Math.random() * (max - min);
  }, [vehicleType]);
  
  const [width, height, depth] = vehicleType.dimensions;
  
  useFrame((state) => {
    if (!ref.current) return;
    
    const time = (state.clock.getElapsedTime() + startTime.current + initialDelay) * speed;
    const t = time % 1;
    
    // Get current position and next position for orientation
    const currentPoint = path.getPointAt(t);
    const nextPoint = path.getPointAt((t + 0.01) % 1);
    
    // Calculate direction vector
    const direction = nextPoint.clone().sub(currentPoint).normalize();
    
    // Update vehicle position
    ref.current.position.copy(currentPoint);
    ref.current.position.y += height / 2; // Lift vehicle to road surface
    
    // Calculate rotation to face direction of travel
    const angle = Math.atan2(direction.x, direction.z);
    ref.current.rotation.y = angle;
    
    // Add slight bobbing motion
    ref.current.position.y += Math.sin(time * 10) * 0.02;
  });

  return (
    <group ref={ref}>
      {/* Main body */}
      <Box args={[depth, height, width]} position={[0, height/2, 0]}>
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </Box>
      
      {/* Roof (for cars and trucks) */}
      {type !== 'bus' && (
        <Box 
          args={[depth, height * 0.4, width * 0.8]} 
          position={[0, height * 1.2, 0]}
        >
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
        </Box>
      )}
      
      {/* Windows */}
      <Box 
        args={[depth + 0.01, height * 0.3, width * 0.3]} 
        position={[0, height, width * 0.2]}
      >
        <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
      </Box>
      
      {/* Wheels */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
        <group key={i} position={[x * depth/3, 0, z * width/2]}>
          <Cylinder args={[0.1, 0.1, 0.1, 8]} rotation={[0, 0, Math.PI/2]}>
            <meshStandardMaterial color="black" />
          </Cylinder>
          <Cylinder args={[0.08, 0.08, 0.12, 8]} rotation={[0, 0, Math.PI/2]}>
            <meshStandardMaterial color="#333" metalness={0.8} />
          </Cylinder>
        </group>
      ))}
    </group>
  );
}

function TrafficLight({ position, rotation = [0, 0, 0] }) {
  const ref = useRef();
  const [state, setState] = useState('red');
  const timeRef = useRef(0);
  
  useFrame((state) => {
    timeRef.current += state.clock.getDelta();
    if (timeRef.current > 5) {
      setState(prev => {
        if (prev === 'red') return 'green';
        if (prev === 'green') return 'yellow';
        return 'red';
      });
      timeRef.current = 0;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Pole */}
      <Cylinder args={[0.05, 0.05, 2]} position={[0, 1, 0]}>
        <meshStandardMaterial color="#666666" />
      </Cylinder>
      
      {/* Light housing */}
      <Box args={[0.2, 0.6, 0.2]} position={[0, 2, 0]}>
        <meshStandardMaterial color="#333333" />
      </Box>
      
      {/* Lights */}
      {['red', 'yellow', 'green'].map((color, i) => (
        <Sphere 
          key={color} 
          args={[0.06]} 
          position={[0, 2.2 - i * 0.2, 0]}
        >
          <meshStandardMaterial 
            color={color}
            emissive={state === color ? color : '#000'}
            emissiveIntensity={state === color ? 2 : 0}
          />
        </Sphere>
      ))}
    </group>
  );
}

function Pedestrian({ path, initialDelay = 0 }) {
  const ref = useRef();
  const startTime = useRef(Math.random() * 100000);
  const speed = useMemo(() => 0.02 + Math.random() * 0.02, []); // Random walking speed
  const bobFrequency = useMemo(() => 8 + Math.random() * 4, []); // Random walking style
  
  useFrame((state) => {
    if (!ref.current) return;
    
    const time = (state.clock.getElapsedTime() + startTime.current + initialDelay) * speed;
    const t = time % 1;
    
    const currentPoint = path.getPointAt(t);
    const nextPoint = path.getPointAt((t + 0.01) % 1);
    
    // Calculate direction vector
    const direction = nextPoint.clone().sub(currentPoint).normalize();
    
    // Update position and rotation
    ref.current.position.copy(currentPoint);
    ref.current.position.y += Math.sin(time * bobFrequency) * 0.05;
    
    // Calculate rotation to face direction of travel
    const angle = Math.atan2(direction.x, direction.z);
    ref.current.rotation.y = angle;
  });

  return (
    <group ref={ref}>
      {/* Body */}
      <Box args={[0.2, 0.6, 0.2]} position={[0, 0.3, 0]}>
        <meshStandardMaterial color="#FFB6C1" />
      </Box>
      {/* Head */}
      <Sphere args={[0.15]} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#FFB6C1" />
      </Sphere>
      {/* Arms */}
      <Box args={[0.4, 0.1, 0.1]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="#FFB6C1" />
      </Box>
      {/* Legs */}
      <Box args={[0.1, 0.3, 0.1]} position={[-0.1, 0.15, 0]}>
        <meshStandardMaterial color="#4A4A4A" />
      </Box>
      <Box args={[0.1, 0.3, 0.1]} position={[0.1, 0.15, 0]}>
        <meshStandardMaterial color="#4A4A4A" />
      </Box>
    </group>
  );
}

export function Traffic() {
  const { roads, locations, timeOfDay } = useCityStore();
  
  const trafficPaths = useMemo(() => {
    return roads.map(road => {
      const from = locations.find(l => l.id === road.from);
      const to = locations.find(l => l.id === road.to);
      
      if (!from || !to) return null;
      
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(...from.position),
        new THREE.Vector3(...to.position)
      ]);
      
      return {
        path: curve,
        type: road.type
      };
    }).filter(Boolean);
  }, [roads, locations]);
  
  const pedestrianPaths = useMemo(() => {
    return roads.map(road => {
      const from = locations.find(l => l.id === road.from);
      const to = locations.find(l => l.id === road.to);
      
      if (!from || !to) return null;
      
      const offset = 1.5;
      const fromPos = new THREE.Vector3(...from.position);
      const toPos = new THREE.Vector3(...to.position);
      
      const direction = toPos.clone().sub(fromPos).normalize();
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
      
      const sidewalkPoints = [
        fromPos.clone().add(perpendicular.clone().multiplyScalar(offset)),
        toPos.clone().add(perpendicular.clone().multiplyScalar(offset))
      ];
      
      return new THREE.CatmullRomCurve3(sidewalkPoints);
    }).filter(Boolean);
  }, [roads, locations]);

  const getTrafficDensity = (hour: number) => {
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
      return 1.5;
    }
    if (hour >= 9 && hour <= 16) {
      return 1.0;
    }
    if (hour >= 23 || hour <= 5) {
      return 0.3;
    }
    return 0.7;
  };

  const trafficDensity = getTrafficDensity(timeOfDay);

  return (
    <>
      {trafficPaths.map((path, i) => {
        const baseVehicleCount = path.type === 'main' ? 4 : 
                                path.type === 'secondary' ? 3 : 2;
        const vehicleCount = Math.floor(baseVehicleCount * trafficDensity);
        
        return Array.from({ length: vehicleCount }).map((_, j) => {
          const vehicleType = (() => {
            const rand = Math.random();
            if (path.type === 'main') {
              if (rand < 0.6) return 'car';
              if (rand < 0.8) return 'bus';
              return 'truck';
            }
            if (path.type === 'secondary') {
              if (rand < 0.7) return 'car';
              if (rand < 0.9) return 'truck';
              return 'bus';
            }
            if (rand < 0.9) return 'car';
            return 'truck';
          })();
          
          return (
            <Vehicle 
              key={`vehicle-${i}-${j}`}
              path={path.path}
              type={vehicleType}
              initialDelay={j * 2}
            />
          );
        });
      })}
      
      {locations.map((location) => {
        const connectedMainRoads = roads.filter(
          road => (road.from === location.id || road.to === location.id) && road.type === 'main'
        );
        
        if (connectedMainRoads.length >= 2) {
          return (
            <TrafficLight
              key={`traffic-light-${location.id}`}
              position={[
                location.position[0] + 2,
                0,
                location.position[2] + 2
              ]}
              rotation={[0, Math.PI / 4, 0]}
            />
          );
        }
        return null;
      })}
      
      {pedestrianPaths.map((path, i) => (
        Array.from({ length: Math.floor(3 * trafficDensity) }).map((_, j) => (
          <Pedestrian 
            key={`pedestrian-${i}-${j}`}
            path={path}
            initialDelay={j * 3}
          />
        ))
      ))}
    </>
  );
}