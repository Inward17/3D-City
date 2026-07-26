import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, PositionMesh } from '@react-three/drei';
import { useCityStore } from '../store/cityStore';
import { Location, Road, Vec3 } from '../types/city';

interface ParticleProps {
  initialPosition: Vec3;
}

function RainDrop({ initialPosition }: ParticleProps) {
  const ref = useRef<PositionMesh>(null);
  const speed = useRef(-Math.random() * 1.6 - 1.8);
  const horizontalSpeed = useRef({
    x: (Math.random() - 0.5) * 0.12,
    z: (Math.random() - 0.5) * 0.12
  });

  useFrame(() => {
    if (ref.current) {
      ref.current.position.y += speed.current;
      ref.current.position.x += horizontalSpeed.current.x;
      ref.current.position.z += horizontalSpeed.current.z;
      
      if (ref.current.position.y < 0) {
        ref.current.position.set(
          initialPosition[0] + (Math.random() - 0.5) * 240,
          initialPosition[1],
          initialPosition[2] + (Math.random() - 0.5) * 240
        );
      }
    }
  });

  return <Instance ref={ref} position={initialPosition} />;
}

function SnowFlake({ initialPosition }: ParticleProps) {
  const ref = useRef<PositionMesh>(null);
  const speed = useRef({
    y: -Math.random() * 0.35 - 0.25,
    x: (Math.random() - 0.5) * 0.15,
    z: (Math.random() - 0.5) * 0.15
  });
  
  useFrame(() => {
    if (ref.current) {
      ref.current.position.y += speed.current.y;
      ref.current.position.x += speed.current.x;
      ref.current.position.z += speed.current.z;
      
      if (ref.current.position.y < 0) {
        ref.current.position.set(
          initialPosition[0] + (Math.random() - 0.5) * 240,
          initialPosition[1],
          initialPosition[2] + (Math.random() - 0.5) * 240
        );
      }
    }
  });

  return <Instance ref={ref} position={initialPosition} />;
}

interface WetRoadsProps {
  locations: Location[];
  roads: Road[];
}

function WetRoads({ locations, roads }: WetRoadsProps) {
  // Generate puddles at intersections and low points
  const puddles = useMemo(() => {
    const puddlePositions: Array<{ position: Vec3; size: number }> = [];

    // Add puddles at major intersections
    roads.forEach((road, index) => {
      if (index % 2 === 0) { // Every other road to avoid too many puddles
        const from = locations.find(l => l.id === road.from);
        const to = locations.find(l => l.id === road.to);
        
        if (!from || !to) return;
        
        // Add puddle at midpoint
        const x = (from.position[0] + to.position[0]) / 2;
        const z = (from.position[2] + to.position[2]) / 2;
        
        puddlePositions.push({
          position: [x, 0, z],
          size: 5 + Math.random() * 9
        });
      }
    });
    
    // Add random puddles in open areas
    for (let i = 0; i < 45; i++) {
      puddlePositions.push({
        position: [
          (Math.random() - 0.5) * 620,
          0,
          (Math.random() - 0.5) * 620
        ],
        size: 3 + Math.random() * 7
      });
    }
    
    return puddlePositions;
  }, [roads, locations]);

  return (
    <>
      {puddles.map((puddle, i) => (
        <mesh 
          key={`puddle-${i}`}
          position={[puddle.position[0], 0.01, puddle.position[2]]} 
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[puddle.size, 16]} />
          <meshStandardMaterial
            color="#4a90e2"
            metalness={0.9}
            roughness={0.1}
            opacity={0.8}
            transparent
            envMapIntensity={1.5}
          />
        </mesh>
      ))}
    </>
  );
}

function SnowAccumulation({ locations }: { locations: Location[] }) {
  return (
    <>
      {/* Snow on ground */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial 
          color="white" 
          transparent 
          opacity={0.6}
          roughness={0.9}
        />
      </mesh>
      
      {/* Snow on building roofs */}
      {locations.map((location, i) => (
        <mesh 
          key={`snow-roof-${i}`}
          position={[location.position[0], 42, location.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[22, 22]} />
          <meshStandardMaterial 
            color="white" 
            transparent 
            opacity={0.8}
            roughness={0.9}
          />
        </mesh>
      ))}
    </>
  );
}

interface WeatherProps {
  locations: Location[];
}

export function Weather({ locations }: WeatherProps) {
  const { weather, roads } = useCityStore();

  // Fog is owned by EnvironmentLayer, which already accounts for weather as
  // well as time of day. This component used to set its own FogExp2 here and
  // the two fought every render — the exponential fog won and greyed out the
  // whole city regardless of the ranges EnvironmentLayer had picked.

  // Weather particles. Spread is matched to the city footprint (~±250) rather
  // than the old 80-unit box, which dropped rain on the centre block only.
  const particles = useMemo(() => {
    const count = weather === 'rain' ? 900 : weather === 'snow' ? 600 : 0;
    const spread = 620;
    const height = 220;

    return Array.from({ length: count }, (): Vec3 => [
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
          <Instances limit={900}>
            <cylinderGeometry args={[0.09, 0.09, 2.4]} />
            <meshBasicMaterial 
              color="#a8c8ff" 
              transparent 
              opacity={0.6}
            />
            {particles.map((position, i) => (
              <RainDrop key={`rain-${i}`} initialPosition={position} />
            ))}
          </Instances>
          <WetRoads locations={locations} roads={roads} />
        </>
      )}
      
      {weather === 'snow' && (
        <>
          <Instances limit={600}>
            <sphereGeometry args={[0.5]} />
            <meshBasicMaterial 
              color="white" 
              transparent 
              opacity={0.8}
            />
            {particles.map((position, i) => (
              <SnowFlake key={`snow-${i}`} initialPosition={position} />
            ))}
          </Instances>
          <SnowAccumulation locations={locations} />
        </>
      )}
    </>
  );
}