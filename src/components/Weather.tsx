import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances, MeshReflectorMaterial } from '@react-three/drei';
import { useCityStore } from '../store/cityStore';
import * as THREE from 'three';

function RainDrop({ initialPosition }) {
  const ref = useRef();
  const speed = useRef(-Math.random() * 0.5 - 0.5);
  const horizontalSpeed = useRef({
    x: (Math.random() - 0.5) * 0.1,
    z: (Math.random() - 0.5) * 0.1
  });
  
  useFrame((state) => {
    if (ref.current) {
      // Add wind effect
      const time = state.clock.getElapsedTime();
      const windEffect = Math.sin(time) * 0.02;
      
      ref.current.position.y += speed.current;
      ref.current.position.x += horizontalSpeed.current.x + windEffect;
      ref.current.position.z += horizontalSpeed.current.z + windEffect;
      
      // Reset position when raindrop hits ground
      if (ref.current.position.y < 0) {
        // Create splash effect
        createRainSplash(ref.current.position.x, ref.current.position.z);
        
        ref.current.position.set(
          initialPosition[0] + (Math.random() - 0.5) * 100,
          initialPosition[1],
          initialPosition[2] + (Math.random() - 0.5) * 100
        );
      }
    }
  });

  // Function to create a splash effect (visual only)
  const createRainSplash = (x, z) => {
    // This would be implemented with particle effects in a full version
    // For now, we'll just handle the position logic
  };

  return <Instance ref={ref} position={initialPosition} />;
}

function SnowFlake({ initialPosition }) {
  const ref = useRef();
  const speed = useRef({
    y: -Math.random() * 0.1 - 0.05,
    x: (Math.random() - 0.5) * 0.05,
    z: (Math.random() - 0.5) * 0.05,
    rotation: (Math.random() - 0.5) * 0.02
  });
  
  useFrame((state) => {
    if (ref.current) {
      const time = state.clock.getElapsedTime();
      const windEffect = Math.sin(time) * 0.01;
      
      ref.current.position.y += speed.current.y;
      ref.current.position.x += speed.current.x + windEffect;
      ref.current.position.z += speed.current.z + windEffect;
      ref.current.rotation.y += speed.current.rotation;
      
      // Reset position when snowflake hits ground
      if (ref.current.position.y < 0) {
        // In a full implementation, we would add to snow accumulation here
        ref.current.position.set(
          initialPosition[0] + (Math.random() - 0.5) * 100,
          initialPosition[1],
          initialPosition[2] + (Math.random() - 0.5) * 100
        );
      }
    }
  });

  return <Instance ref={ref} position={initialPosition} />;
}

function Puddle({ position, size }) {
  return (
    <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[size, 32]} />
      <MeshReflectorMaterial
        blur={[400, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={15}
        depthScale={1}
        minDepthThreshold={0.85}
        color="#a8c8ff"
        metalness={0.6}
        roughness={0.2}
        opacity={0.7}
        transparent
      />
    </mesh>
  );
}

function WetRoads() {
  const { roads, locations } = useCityStore();
  
  // Generate puddles along roads
  const puddles = useMemo(() => {
    const puddlePositions = [];
    
    // Create puddles at low points and intersections
    roads.forEach(road => {
      const from = locations.find(l => l.id === road.from);
      const to = locations.find(l => l.id === road.to);
      
      if (!from || !to) return;
      
      // Create puddles at random points along the road
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        const t = Math.random();
        const x = from.position[0] + (to.position[0] - from.position[0]) * t;
        const z = from.position[2] + (to.position[2] - from.position[2]) * t;
        
        // Add some random offset from the road center
        const offset = (Math.random() - 0.5) * 1.5;
        const dx = -(to.position[2] - from.position[2]);
        const dz = (to.position[0] - from.position[0]);
        const length = Math.sqrt(dx * dx + dz * dz);
        
        if (length > 0) {
          const nx = dx / length;
          const nz = dz / length;
          
          puddlePositions.push({
            position: [x + nx * offset, 0, z + nz * offset],
            size: 0.5 + Math.random() * 1.5
          });
        }
      }
    });
    
    // Add puddles at some intersections
    locations.forEach(location => {
      if (Math.random() < 0.3) {
        puddlePositions.push({
          position: [
            location.position[0] + (Math.random() - 0.5) * 3,
            0,
            location.position[2] + (Math.random() - 0.5) * 3
          ],
          size: 1 + Math.random() * 2
        });
      }
    });
    
    return puddlePositions;
  }, [roads, locations]);

  return (
    <>
      {puddles.map((puddle, i) => (
        <Puddle key={`puddle-${i}`} position={puddle.position} size={puddle.size} />
      ))}
    </>
  );
}

function SnowAccumulation() {
  const { locations } = useCityStore();
  
  return (
    <>
      {/* Snow on ground */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial 
          color="white" 
          transparent 
          opacity={0.7}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      
      {/* Snow on rooftops */}
      {locations.map((location, i) => (
        <mesh 
          key={`snow-roof-${i}`}
          position={[
            location.position[0], 
            location.type === 'Building' ? 3 : 
            location.type === 'Hotel' ? 4 : 
            location.type === 'School' || location.type === 'Hospital' ? 2 : 1,
            location.position[2]
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[
            location.type === 'Building' || location.type === 'Hotel' ? 1 :
            location.type === 'School' || location.type === 'Hospital' ? 2 : 1
          ]} />
          <meshStandardMaterial 
            color="white" 
            transparent 
            opacity={0.9}
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
      ))}
    </>
  );
}

export function Weather() {
  const { weather, timeOfDay } = useCityStore();
  const { scene } = useThree();
  
  // Dynamic fog based on weather and time
  useEffect(() => {
    if (weather === 'rain') {
      scene.fog = new THREE.FogExp2('#8ca9c0', 0.02);
    } else if (weather === 'snow') {
      scene.fog = new THREE.FogExp2('#e5e7eb', 0.015);
    } else if (timeOfDay < 6 || timeOfDay > 18) {
      scene.fog = new THREE.FogExp2('#0f172a', 0.01);
    } else {
      scene.fog = new THREE.FogExp2('#e0f2fe', 0.005);
    }
    
    return () => {
      scene.fog = null;
    };
  }, [weather, timeOfDay, scene]);
  
  const particles = useMemo(() => {
    const count = weather === 'rain' ? 2000 : weather === 'snow' ? 1000 : 0;
    const spread = 100; // Increased spread
    const height = 30;
    
    return Array.from({ length: count }, () => [
      (Math.random() - 0.5) * spread,
      height + Math.random() * 10,
      (Math.random() - 0.5) * spread
    ]);
  }, [weather]);

  if (!weather || weather === 'clear') return null;

  return (
    <>
      {weather === 'rain' && (
        <>
          <Instances limit={2000}>
            <cylinderGeometry args={[0.01, 0.01, 0.2]} />
            <meshStandardMaterial color="#a8c8ff" transparent opacity={0.5} />
            {particles.map((position, i) => (
              <RainDrop key={`rain-${i}`} initialPosition={position} />
            ))}
          </Instances>
          <WetRoads />
        </>
      )}
      
      {weather === 'snow' && (
        <>
          <Instances limit={1000}>
            <sphereGeometry args={[0.05]} />
            <meshStandardMaterial 
              color="white" 
              transparent 
              opacity={0.8}
              envMapIntensity={0.2}
            />
            {particles.map((position, i) => (
              <SnowFlake key={`snow-${i}`} initialPosition={position} />
            ))}
          </Instances>
          <SnowAccumulation />
        </>
      )}
    </>
  );
}