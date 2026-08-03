import { useRef, useMemo, useEffect } from 'react';
import { Location } from '../../types/city';
import { hashUnit } from '../../utils/buildingDimensions';
import { PARK_TREE } from '../../utils/scale';
import * as THREE from 'three';
import { elevationAt } from '../../utils/terrain';

interface InstancedTreesProps {
  locations: Location[];
}

interface TreeInstance {
  position: THREE.Vector3;
  scale: THREE.Vector3;
}

const TREES_PER_PARK = 14;

/**
 * Ring of trees around a park.
 *
 * Layout is derived from the park id rather than Math.random(), so the trees
 * stay put; previously any change that produced a new locations array
 * reshuffled every tree in the city.
 */
function generateTreeInstances(parkLocation: Location): TreeInstance[] {
  const trees: TreeInstance[] = [];
  const seed = hashUnit(parkLocation.id);

  for (let i = 0; i < TREES_PER_PARK; i++) {
    // Two decorrelated pseudo-random values per tree, stable for this park.
    const r1 = (Math.sin((seed + 1) * 91.7 + i * 12.9898) + 1) / 2;
    const r2 = (Math.sin((seed + 1) * 47.3 + i * 78.233) + 1) / 2;

    const angle = (i / TREES_PER_PARK) * Math.PI * 2 + r1 * 0.4;
    const radius = 14 + r1 * 14;
    // Uniform scale around a real tree size; 0.85x - 1.25x of the reference.
    const scale = 0.85 + r2 * 0.4;

    const x = parkLocation.position[0] + Math.cos(angle) * radius;
    const z = parkLocation.position[2] + Math.sin(angle) * radius;

    trees.push({
      // Each tree stands on the ground beneath it. Taking the park's own level
      // instead left trees hanging in the air on one side of a slope and buried
      // on the other.
      position: new THREE.Vector3(x, elevationAt(x, z), z),
      scale: new THREE.Vector3(scale, scale, scale)
    });
  }
  return trees;
}

function ParkTrees({ location }: { location: Location }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageRef = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() => generateTreeInstances(location), [location]);

  useEffect(() => {
    if (!trunkRef.current || !foliageRef.current || trees.length === 0) return;

    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();

    /*
      Trunk and canopy are placed from the real tree dimensions in scale.ts and
      scaled together, so the canopy always sits on top of its own trunk.

      The old maths scaled the two parts by different factors (0.1x and 0.5x)
      and offset them by different multiples of the same number, which produced
      a 0.9 m trunk hovering at 4.5 m with its canopy floating separately at
      10.8 m — two disconnected objects rather than a tree.
    */
    trees.forEach((tree, i) => {
      const s = tree.scale.x;

      // Trunk: geometry is a unit-height cylinder, so scale carries the height.
      tempPosition.copy(tree.position);
      tempPosition.y += (PARK_TREE.trunkHeight * s) / 2;
      tempScale.set(
        PARK_TREE.trunkRadius * 2 * s,
        PARK_TREE.trunkHeight * s,
        PARK_TREE.trunkRadius * 2 * s
      );
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      trunkRef.current!.setMatrixAt(i, tempMatrix);

      // Canopy: centred a little above the top of the trunk so they overlap.
      tempPosition.copy(tree.position);
      tempPosition.y += (PARK_TREE.trunkHeight + PARK_TREE.canopyRadius * 0.7) * s;
      tempScale.setScalar(PARK_TREE.canopyRadius * s);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      foliageRef.current!.setMatrixAt(i, tempMatrix);
    });

    trunkRef.current.instanceMatrix.needsUpdate = true;
    foliageRef.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <group position={location.position as [number, number, number]}>
      {/* Trunk: unit cylinder (radius 0.5, height 1) so the instance scale maps
          directly to real metres. */}
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 1, 8]} />
        <meshStandardMaterial color="#5a4632" roughness={0.95} />
      </instancedMesh>

      {/* Canopy: unit sphere (radius 1), scaled to the canopy radius. */}
      <instancedMesh ref={foliageRef} args={[undefined, undefined, trees.length]} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#3f8f52" roughness={0.9} />
      </instancedMesh>

      {/*
        Trees only. This component used to draw its own park ground disc and
        path ring as well, which sat at the same height as the lawn rendered by
        the Park component in layers/Buildings — two overlapping discs that
        z-fought. The Park component owns the ground.
      */}
    </group>
  );
}

export function InstancedTrees({ locations }: InstancedTreesProps) {
  const parks = useMemo(() =>
    locations.filter(loc => loc.type === 'Park'),
    [locations]);

  return (
    <>
      {parks.map((location) => (
        <ParkTrees key={location.id} location={location} />
      ))}
    </>
  );
}
