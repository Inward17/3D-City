import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCityStore } from '../../store/cityStore';
import { Crossing, roundaboutRadii } from '../../utils/roadCrossings';
import { elevationAt } from '../../utils/terrain';
import { ROAD_SURFACE_Y, PARK_TREE } from '../../utils/scale';

/**
 * Intersection furniture, drawn at road crossings.
 *
 * This used to be placed at *buildings* — because roads connect buildings, the
 * old code treated every building where roads terminated as a junction. That
 * put a 22 m roundabout, complete with a raised island and three trees, right
 * through City Hall, and dropped signal poles inside other buildings'
 * footprints. Junction furniture only makes sense where two carriageways
 * actually cross.
 */

/** Signal cycle, in seconds. */
const GREEN_TIME = 7;
const AMBER_TIME = 2;
const CYCLE = (GREEN_TIME + AMBER_TIME) * 2;

function Roundabout({ crossing }: { crossing: Crossing }) {
  // Shared with routeAroundRoundabouts, so the tarmac and the driving line
  // describe the same circle.
  const { outer, island } = roundaboutRadii(crossing);

  return (
    <group position={[crossing.point.x, elevationAt(crossing.point.x, crossing.point.y), crossing.point.y]}>
      {/* Circulating carriageway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_SURFACE_Y + 0.02, 0]} receiveShadow>
        <ringGeometry args={[island, outer, 48]} />
        <meshStandardMaterial color="#2b3038" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Kerb around the island */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_SURFACE_Y + 0.04, 0]}>
        <ringGeometry args={[island - 0.6, island, 48]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Raised planted island */}
      <mesh position={[0, ROAD_SURFACE_Y + 0.3, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[island - 0.6, island - 0.6, 0.6, 32]} />
        <meshStandardMaterial color="#3f8f52" roughness={0.95} />
      </mesh>

      {[0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2;
        const r = island * 0.4;
        return (
          <group key={i} position={[Math.cos(angle) * r, ROAD_SURFACE_Y + 0.6, Math.sin(angle) * r]}>
            <mesh position={[0, PARK_TREE.trunkHeight / 2, 0]} castShadow>
              <cylinderGeometry args={[PARK_TREE.trunkRadius, PARK_TREE.trunkRadius, PARK_TREE.trunkHeight, 6]} />
              <meshStandardMaterial color="#5a4632" roughness={0.95} />
            </mesh>
            <mesh position={[0, PARK_TREE.trunkHeight + PARK_TREE.canopyRadius * 0.6, 0]} castShadow>
              <sphereGeometry args={[PARK_TREE.canopyRadius * 0.8, 10, 8]} />
              <meshStandardMaterial color="#3f8f52" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** One signal head: pole, housing and three lenses. */
function SignalHead({
  position,
  bearing,
  phase
}: {
  position: [number, number, number];
  bearing: number;
  phase: 0 | 1;
}) {
  const redRef = useRef<THREE.MeshStandardMaterial>(null);
  const amberRef = useRef<THREE.MeshStandardMaterial>(null);
  const greenRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    // Opposing approaches run half a cycle apart.
    const seconds = (elapsed + (phase === 1 ? CYCLE / 2 : 0)) % CYCLE;

    const green = seconds < GREEN_TIME;
    const amber = !green && seconds < GREEN_TIME + AMBER_TIME;
    const red = !green && !amber;

    const set = (
      m: React.RefObject<THREE.MeshStandardMaterial>,
      on: boolean,
      colour: string
    ) => {
      if (!m.current) return;
      m.current.emissiveIntensity = on ? 4 : 0.05;
      m.current.color.set(on ? colour : '#2a2a2a');
    };

    set(redRef, red, '#ff3b30');
    set(amberRef, amber, '#ffb020');
    set(greenRef, green, '#2fd15a');
  });

  return (
    <group position={position} rotation={[0, bearing, 0]}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 3.2, 8]} />
        <meshStandardMaterial color="#3f4650" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[0, 3.5, 0]} castShadow>
        <boxGeometry args={[0.34, 0.95, 0.28]} />
        <meshStandardMaterial color="#22262c" roughness={0.7} />
      </mesh>

      {/* Lenses, top to bottom: red, amber, green */}
      <mesh position={[0, 3.82, 0.16]}>
        <circleGeometry args={[0.1, 12]} />
        <meshStandardMaterial ref={redRef} emissive="#ff3b30" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.5, 0.16]}>
        <circleGeometry args={[0.1, 12]} />
        <meshStandardMaterial ref={amberRef} emissive="#ffb020" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.18, 0.16]}>
        <circleGeometry args={[0.1, 12]} />
        <meshStandardMaterial ref={greenRef} emissive="#2fd15a" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
    </group>
  );
}

function SignalisedCrossing({ crossing }: { crossing: Crossing }) {
  const half = crossing.junctionWidth * 0.75;

  // Four approaches around the crossing point.
  const approaches = [0, 1, 2, 3].map(i => (i * Math.PI) / 2);

  return (
    <group position={[crossing.point.x, elevationAt(crossing.point.x, crossing.point.y), crossing.point.y]}>
      {/* Tarmac patch covering the overlap of the two carriageways */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_SURFACE_Y + 0.015, 0]} receiveShadow>
        <circleGeometry args={[half, 28]} />
        <meshStandardMaterial color="#2b3038" roughness={0.85} />
      </mesh>

      {approaches.map((bearing, i) => (
        <group key={i}>
          <mesh
            position={[Math.sin(bearing) * half * 0.85, ROAD_SURFACE_Y + 0.05, Math.cos(bearing) * half * 0.85]}
            rotation={[-Math.PI / 2, 0, -bearing]}
          >
            <planeGeometry args={[crossing.junctionWidth * 0.55, 0.5]} />
            <meshStandardMaterial color="#e8e4d9" roughness={0.7} />
          </mesh>

          <SignalHead
            position={[
              Math.sin(bearing) * half + Math.cos(bearing) * (half * 0.55),
              0,
              Math.cos(bearing) * half - Math.sin(bearing) * (half * 0.55)
            ]}
            bearing={bearing + Math.PI}
            phase={(i % 2) as 0 | 1}
          />
        </group>
      ))}
    </group>
  );
}

/**
 * Selectable marker for a crossing.
 *
 * The visible ring is thin, so the click target is a separate invisible disc
 * covering the whole intersection — a 1.5 m band of ring is very hard to hit
 * from a shallow camera angle. A post makes the marker findable when looking
 * across the city rather than down at it.
 */
function CrossingMarker({ crossing, selected }: { crossing: Crossing; selected: boolean }) {
  const setSelectedCrossing = useCityStore(s => s.setSelectedCrossing);
  const radius = crossing.junctionWidth * 0.9;

  const select = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedCrossing(selected ? null : crossing.key);
  };

  return (
    <group position={[crossing.point.x, elevationAt(crossing.point.x, crossing.point.y), crossing.point.y]}>
      {/* Hit target */}
      <mesh
        position={[0, ROAD_SURFACE_Y + 0.3, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={select}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        visible={false}
      >
        <circleGeometry args={[radius, 24]} />
        <meshBasicMaterial />
      </mesh>

      <mesh position={[0, ROAD_SURFACE_Y + 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[radius * 0.82, radius, 32]} />
        <meshBasicMaterial
          color={selected ? '#38bdf8' : '#94a3b8'}
          transparent
          opacity={selected ? 0.95 : 0.4}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {/* Post, so the marker is visible from a low angle too. */}
      <mesh position={[0, 4, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.25, 0.25, 8, 6]} />
        <meshBasicMaterial
          color={selected ? '#38bdf8' : '#94a3b8'}
          transparent
          opacity={selected ? 0.85 : 0.3}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}

export function JunctionsLayer({ crossings }: { crossings: Crossing[] }) {
  const selectedCrossing = useCityStore(s => s.selectedCrossing);

  return (
    <group name="intersections">
      {crossings.map(crossing => (
        <group key={crossing.key}>
          {crossing.style === 'roundabout' && <Roundabout crossing={crossing} />}
          {crossing.style === 'signals' && <SignalisedCrossing crossing={crossing} />}
          <CrossingMarker crossing={crossing} selected={selectedCrossing === crossing.key} />
        </group>
      ))}
    </group>
  );
}
