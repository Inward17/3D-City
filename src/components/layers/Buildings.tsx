import { useMemo, useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useCityStore } from '../../store/cityStore';
import { Location } from '../../types/city';
import { InstancedWindows } from '../optimized/InstancedWindows';
import { InstancedTrees } from '../optimized/InstancedTrees';
import { getEffectiveDimensions, hashUnit } from '../../utils/buildingDimensions';
import * as THREE from 'three';

interface BuildingsLayerProps {
  locations: Location[];
}

function Building({ location }: { location: Location }) {
  const {
    selectedLocation,
    setSelectedLocation,
    isPlacingBuilding,
    isPlacingRoute,
    routeStartId,
    pickRouteEndpoint
  } = useCityStore();
  const [hovered, setHovered] = useState(false);

  const isSelected = selectedLocation?.id === location.id;
  const isRouteStart = routeStartId === location.id;
  // Design overrides applied here; falls back to the type footprint with the
  // usual stable per-id height variation.
  const dims = useMemo(() => getEffectiveDimensions(location), [location]);
  const variation = useMemo(() => hashUnit(location.id), [location.id]);
  const height = dims.height;
  const roof = location.design?.roof ?? 'flat';

  const baseColor = useMemo(() => {
    const c = new THREE.Color(location.design?.color || location.color || '#7c8ba1');
    // Nudge lightness by the same stable hash.
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s * 0.85, Math.min(0.72, hsl.l * (0.85 + variation * 0.3)));
    return c;
    // The design colour must be a dependency: without it, picking a new facade
    // in the design editor updated the stored data but never recomputed the
    // material, so the building kept its old colour until a reload.
  }, [location.design?.color, location.color, variation]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    // While placing a building, clicks belong to the ground plane.
    if (isPlacingBuilding) return;
    event.stopPropagation();

    // In route mode a building click is an endpoint pick, not a selection.
    if (isPlacingRoute) {
      void pickRouteEndpoint(location.id);
      return;
    }

    setSelectedLocation(location);
  };

  const emissiveIntensity = isRouteStart ? 0.8 : isSelected ? 0.55 : hovered ? 0.25 : 0;
  const emissiveColor = isRouteStart ? '#34d399' : isSelected ? '#38bdf8' : '#7dd3fc';

  return (
    <group position={[location.position[0], location.position[1], location.position[2]]}>
      {/* Plinth: a slightly wider slab grounds the building instead of letting
          it float straight out of the grass. */}
      <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
        <boxGeometry args={[dims.width + 2.5, 0.8, dims.depth + 2.5]} />
        <meshStandardMaterial color="#3f4753" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Main mass */}
      <mesh
        position={[0, height / 2 + 0.8, 0]}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={(e) => {
          if (isPlacingBuilding) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = isPlacingRoute ? 'crosshair' : 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[dims.width, height, dims.depth]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.62}
          metalness={0.18}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* Roof, per the chosen style */}
      {roof === 'pitched' ? (
        // Four-sided pyramid: a cone with 4 radial segments, rotated to square
        // up with the footprint.
        <mesh
          position={[0, height + 0.8 + dims.width * 0.22, 0]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
        >
          <coneGeometry
            args={[Math.max(dims.width, dims.depth) * 0.72, dims.width * 0.45, 4]}
          />
          <meshStandardMaterial color="#7a4b3a" roughness={0.9} metalness={0.05} />
        </mesh>
      ) : roof === 'stepped' ? (
        // Two setbacks, the classic tiered silhouette.
        <>
          <mesh position={[0, height + 0.8 + 1.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[dims.width * 0.78, 3.2, dims.depth * 0.78]} />
            <meshStandardMaterial color={baseColor} roughness={0.62} metalness={0.18} />
          </mesh>
          <mesh position={[0, height + 0.8 + 4.4, 0]} castShadow>
            <boxGeometry args={[dims.width * 0.5, 3, dims.depth * 0.5]} />
            <meshStandardMaterial color={baseColor} roughness={0.62} metalness={0.18} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, height + 0.8 + 0.35, 0]} castShadow>
          <boxGeometry args={[dims.width * 0.92, 0.7, dims.depth * 0.92]} />
          <meshStandardMaterial color="#2f3742" roughness={0.85} metalness={0.15} />
        </mesh>
      )}

      {/* Rooftop unit — a small asymmetric detail reads as "building" far more
          than a bare box does. Skipped on pitched roofs, where it would float. */}
      {roof !== 'pitched' && (
        <mesh
          position={[
            dims.width * (variation - 0.5) * 0.35,
            height + (roof === 'stepped' ? 7.4 : 2.2),
            dims.depth * (variation - 0.5) * 0.35
          ]}
          castShadow
        >
          <boxGeometry args={[dims.width * 0.22, 2.2, dims.depth * 0.22]} />
          <meshStandardMaterial color="#39424f" roughness={0.9} />
        </mesh>
      )}

      {/* Selection / route-start ring on the ground */}
      {(isSelected || isRouteStart) && (
        <mesh position={[0, 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[dims.width * 0.85, dims.width * 0.98, 48]} />
          <meshBasicMaterial
            color={isRouteStart ? '#34d399' : '#38bdf8'}
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

function Park({ location }: { location: Location }) {
  const { selectedLocation, setSelectedLocation, isPlacingBuilding } = useCityStore();
  const isSelected = selectedLocation?.id === location.id;

  return (
    <group position={[location.position[0], location.position[1], location.position[2]]}>
      <mesh
        position={[0, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          if (isPlacingBuilding) return;
          e.stopPropagation();
          setSelectedLocation(location);
        }}
      >
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial
          color={isSelected ? '#4ade80' : '#3f8f52'}
          roughness={0.95}
          emissive="#22c55e"
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {/* Path ring around the lawn */}
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[30, 32.5, 48]} />
        <meshStandardMaterial color="#8b7a5e" roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function BuildingsLayer({ locations }: BuildingsLayerProps) {
  const buildings = useMemo(() => locations.filter(loc => loc.type !== 'Park'), [locations]);
  const parks = useMemo(() => locations.filter(loc => loc.type === 'Park'), [locations]);

  return (
    <>
      {/*
        Single building representation. This layer used to stack
        MergedBuildingGeometry, LODBuildings and invisible interaction proxies on
        top of each other — three sets of boxes at identical coordinates, which
        z-fought and doubled the shadow casters. The mesh below is now both the
        visual and the click target.
      */}
      {buildings.map(location => (
        <Building key={location.id} location={location} />
      ))}

      {/* Lit windows, driven by time of day */}
      <InstancedWindows locations={buildings} />

      {parks.map(location => (
        <Park key={location.id} location={location} />
      ))}

      <InstancedTrees locations={parks} />
    </>
  );
}
