import { useRef, useMemo, useEffect } from 'react';
import { useCityStore } from '../../store/cityStore';
import { Location } from '../../types/city';
import * as THREE from 'three';
import { getEffectiveDimensions, hashUnit } from '../../utils/buildingDimensions';
import { groundLevelFor } from '../../utils/terrain';

interface InstancedWindowsProps {
  locations: Location[];
}

// Window data structure
interface WindowData {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  isLit: boolean;
  buildingId: string;
}

// Generate all window positions and states
function generateWindowData(locations: Location[], timeOfDay: number): WindowData[] {
  const windows: WindowData[] = [];
  const isNight = timeOfDay < 6 || timeOfDay > 18;
  const isBusinessHours = timeOfDay >= 9 && timeOfDay <= 17;

  locations.forEach((location) => {
    if (location.type === 'Park') return;

    // Effective dimensions, so windows follow any design edits (resized
    // footprint, changed floor count) rather than the type defaults.
    const dimensions = getEffectiveDimensions(location);
    const PLINTH = 0.8;
    const rows = Math.max(1, Math.floor((dimensions.height - 4) / 4));

    /*
      Columns are counted per face, from the wall that face actually runs along.
      Both the sides and the front used to use the width: on any building whose
      depth differed from its width, the side windows were laid out to the wrong
      length and ran off the end of the wall into open air.
    */
    const columnsFor = (wallLength: number) => Math.max(1, Math.floor(wallLength / 3));
    const acrossWidth = columnsFor(dimensions.width);
    const acrossDepth = columnsFor(dimensions.depth);

    /*
      Windows are drawn in world space, but the building is drawn inside a group
      standing on its platform. `position[1]` is always zero in the stored data,
      so once buildings moved onto the terrain every window stayed at sea level
      and hung beside its own facade.
    */
    const base = groundLevelFor(location) + PLINTH;

    /** Offset of a column from the centre of a wall of `count` windows. */
    const offset = (col: number, count: number) => (col - (count - 1) / 2) * 3;

    let lightProbability = 0.3;
    if (isNight) {
      lightProbability = location.type === 'Hospital' ? 0.8 :
        location.type === 'Hotel' ? 0.7 :
          location.type === 'School' ? 0.2 : 0.5;
    } else if (isBusinessHours) {
      lightProbability = location.type === 'Building' ? 0.9 :
        location.type === 'Hospital' ? 0.8 :
          location.type === 'School' ? 0.9 : 0.6;
    }

    /*
      Which windows are lit is decided by a hash of the building and the pane,
      not by Math.random(). The whole set is regenerated whenever the clock
      moves, so a random draw re-rolled every window on every tick of the time
      slider and the facades flickered as it was dragged.
    */
    const lit = (face: number, row: number, col: number) =>
      hashUnit(`${location.id}:${face}:${row}:${col}`) < lightProbability;

    for (let row = 0; row < rows; row++) {
      const y = base + row * 4 + 3;

      // Front and back: along the width, offset by half the depth.
      for (let col = 0; col < acrossWidth; col++) {
        for (const [face, side] of [[0, 1], [1, -1]] as const) {
          windows.push({
            position: new THREE.Vector3(
              location.position[0] + offset(col, acrossWidth),
              y,
              location.position[2] + side * (dimensions.depth / 2 + 0.1)
            ),
            scale: new THREE.Vector3(2, 3, 0.5),
            isLit: lit(face, row, col),
            buildingId: location.id
          });
        }
      }

      // Sides: along the depth, offset by half the width. Only worth drawing on
      // a wall long enough to hold more than a single pane.
      if (dimensions.depth > 15) {
        for (let col = 0; col < acrossDepth; col++) {
          for (const [face, side] of [[2, 1], [3, -1]] as const) {
            windows.push({
              position: new THREE.Vector3(
                location.position[0] + side * (dimensions.width / 2 + 0.1),
                y,
                location.position[2] + offset(col, acrossDepth)
              ),
              scale: new THREE.Vector3(0.5, 3, 2),
              isLit: lit(face, row, col),
              buildingId: location.id
            });
          }
        }
      }
    }
  });

  return windows;
}



export function InstancedWindows({ locations }: InstancedWindowsProps) {
  const litWindowsRef = useRef<THREE.InstancedMesh>(null);
  const darkWindowsRef = useRef<THREE.InstancedMesh>(null);
  const timeOfDay = useCityStore(s => s.timeOfDay);
  const isNight = timeOfDay < 6 || timeOfDay > 18;

  // Generate window data
  const windowData = useMemo(() =>
    generateWindowData(locations, timeOfDay),
    [locations, timeOfDay]);

  // Separate lit and dark windows for different materials
  const { litWindows, darkWindows } = useMemo(() => {
    const lit = windowData.filter(w => w.isLit);
    const dark = windowData.filter(w => !w.isLit);
    return { litWindows: lit, darkWindows: dark };
  }, [windowData]);

  // Update instanced matrices
  useEffect(() => {
    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempQuaternion = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();

    // Update lit windows
    if (litWindowsRef.current && litWindows.length > 0) {
      litWindows.forEach((window, i) => {
        tempPosition.copy(window.position);
        tempQuaternion.set(0, 0, 0, 1);
        tempScale.copy(window.scale);

        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        litWindowsRef.current!.setMatrixAt(i, tempMatrix);
      });

      litWindowsRef.current.instanceMatrix.needsUpdate = true;
      litWindowsRef.current.count = litWindows.length;
    }

    // Update dark windows
    if (darkWindowsRef.current && darkWindows.length > 0) {
      darkWindows.forEach((window, i) => {
        tempPosition.copy(window.position);
        tempQuaternion.set(0, 0, 0, 1);
        tempScale.copy(window.scale);

        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        darkWindowsRef.current!.setMatrixAt(i, tempMatrix);
      });

      darkWindowsRef.current.instanceMatrix.needsUpdate = true;
      darkWindowsRef.current.count = darkWindows.length;
    }
  }, [litWindows, darkWindows]);

  /*
    A "pulsing windows" effect used to run here for the selected building. It
    was removed rather than tuned, because it was broken as well as noisy:

      litWindowsRef.getMatrixAt(i, m)      // read the CURRENT matrix
      m.decompose(pos, quat, scale)
      scale.multiplyScalar(1 + sin(t) * 0.1)   // scale the already-scaled value
      litWindowsRef.setMatrixAt(i, m)

    Each frame re-scaled the result of the previous frame instead of scaling the
    window's base size, so the factor compounded every frame and the panes drifted
    off their true dimensions — visibly bulging out of the facade as blocks. Nothing
    ever restored them, so deselecting left the building stuck at whatever size the
    drift had reached, and only a reload put it back.

    Selection is still shown by the emissive lift and the ground ring on the
    building itself, which don't touch geometry.
  */

  return (
    <group>
      {/* Lit windows - single draw call */}
      <instancedMesh
        ref={litWindowsRef}
        args={[undefined, undefined, Math.max(litWindows.length, 1)]}
      >
        <boxGeometry args={[1, 1, 1]} />
        {/*
          Emissive is driven by the clock. It used to be a flat 0.8 at all
          hours, so windows added nothing after dark — which is a large part of
          why night read as a black mass.
        */}
        <meshStandardMaterial
          color={isNight ? '#ffe9b0' : '#cfe4ff'}
          emissive={isNight ? '#ffcf6e' : '#9fc3e8'}
          emissiveIntensity={isNight ? 2.6 : 0.35}
          toneMapped={false}
          metalness={0.1}
          roughness={0.3}
        />
      </instancedMesh>

      {/* Dark windows - single draw call */}
      <instancedMesh
        ref={darkWindowsRef}
        args={[undefined, undefined, Math.max(darkWindows.length, 1)]}
      >
        <boxGeometry args={[1, 1, 1]} />
        {/* Slightly lifted at night so unlit panes still read as glass rather
            than holes cut out of the facade. */}
        <meshStandardMaterial
          color={isNight ? '#33405c' : '#1f2937'}
          metalness={0.7}
          roughness={0.25}
        />
      </instancedMesh>
    </group>
  );
}