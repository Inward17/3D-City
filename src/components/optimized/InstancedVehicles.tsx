import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useCityStore } from '../../store/cityStore';
import { Location, Road } from '../../types/city';
import * as THREE from 'three';
import { createCarGeometry, createBusGeometry, createTruckGeometry } from '../../utils/vehicleGeometries';
import { headingFromVector } from '../../utils/vehicleHeading';
import { computeTrafficDemand, MAX_VEHICLES } from '../../utils/trafficDemand';
import { CAR, BUS, TRUCK } from '../../utils/scale';
import {
  tripsToDrivablePaths, sampleByFlow, nextTripFrom, advanceAlongTrip, DrivablePath
} from '../../utils/tripModel';
import { useRoadNetwork } from '../../hooks/useRoadNetwork';
import { useAssignment } from '../../hooks/useAssignment';

interface InstancedVehiclesProps {
  locations: Location[];
  roads: Road[];
}

// Vehicle configurations
interface VehicleConfig {
  geometry: number[];
  colors: string[];
  count: number;
  /** Range of multipliers applied to the road's free-flow speed. */
  speedFactor: number[];
}

/*
  Colours are muted towards realistic paintwork; the previous set was pure
  #ff4444 / #44ff44 primaries which read as toys next to the muted buildings.
  `count` is retained only as a mix hint — the actual number on screen comes
  from computeTrafficDemand.

  `speedFactor` scales the road's free-flow speed: a bus or a truck is slower
  than the cars around it and accelerates worse. It replaces `speedRange`, which
  was in fractions-of-road per second — so the same "speed" meant 63 km/h on a
  350 m road and 18 km/h on a 100 m one, and every vehicle crossed every road in
  the same number of seconds regardless of how long it was.
*/
const VEHICLE_CONFIGS: Record<string, VehicleConfig> = {
  cars: {
    geometry: [CAR.length, CAR.height, CAR.width],
    colors: ['#b8332f', '#2f4f7a', '#c9ccd1', '#31363b', '#7a8a99', '#3d6b4a'],
    count: 60,
    speedFactor: [0.85, 1.05]
  },
  buses: {
    geometry: [BUS.length, BUS.height, BUS.width],
    colors: ['#2f6cb5', '#c8761f', '#5a8f3c'],
    count: 15,
    speedFactor: [0.6, 0.72]
  },
  trucks: {
    geometry: [TRUCK.length, TRUCK.height, TRUCK.width],
    colors: ['#7a5230', '#57457f', '#4a6b35'],
    count: 25,
    speedFactor: [0.65, 0.8]
  }
};

// Vehicle data structure
interface VehicleData {
  pathIndex: number;
  /** Fraction of the current trip completed, 0..1. */
  progress: number;
  /** Multiplier on the trip's free-flow speed, not a speed itself. */
  speedFactor: number;
  color: string;
  active: boolean;
}

// Individual vehicle type component
function InstancedVehicleType({
  type,
  config,
  vehicleData,
  trafficPaths
}: {
  type: string;
  config: VehicleConfig;
  vehicleData: VehicleData[];
  trafficPaths: DrivablePath[];
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Time of day is no longer applied to speed here: it now drives how many
  // vehicles exist (via computeTrafficDemand), and multiplying speed as well
  // double-counted the effect — rush hour made the few remaining cars sprint.

  const upVector = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tempScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  const geometry = useMemo(() => {
    if (type === 'cars') return createCarGeometry();
    if (type === 'buses') return createBusGeometry();
    if (type === 'trucks') return createTruckGeometry();
    const geom = VEHICLE_CONFIGS[type]?.geometry || [1, 1, 1];
    return new THREE.BoxGeometry(geom[0], geom[1], geom[2]);
  }, [type]);

  // Update vehicle positions
  useFrame((_state, delta) => {
    if (!meshRef.current || trafficPaths.length === 0) return;

    let activeCount = 0;

    vehicleData.forEach((vehicle, i) => {
      if (!vehicle.active || !trafficPaths[vehicle.pathIndex]) return;

      const path = trafficPaths[vehicle.pathIndex];

      vehicle.progress = advanceAlongTrip(vehicle.progress, path, vehicle.speedFactor, delta);

      // Arrived: drive on from here, rather than reappearing across the city.
      if (vehicle.progress >= 1) {
        vehicle.progress = 0;
        vehicle.pathIndex = nextTripFrom(trafficPaths, path.toId, Math.random());
      }

      // Get position and direction
      const currentPoint = path.curve.getPointAt(vehicle.progress);

      // Geometry is modelled from the ground up, so the origin sits on the road
      // surface. The curve already carries the surface height — including the
      // ramp over any bridge — so the point's own y is used rather than a flat
      // constant, which would drive vehicles through the deck.
      tempPosition.copy(currentPoint);

      /*
        Heading. See headingFromVector for why this is atan2(-dz, dx) and not
        atan2(dx, dz) — the latter aligns +Z with travel and left every vehicle
        broadside to its direction of motion.

        getTangentAt is used rather than differencing two sampled points so the
        direction stays well defined at the very end of the curve, where the
        old `progress + 0.01` clamp could collapse to a zero-length vector.
      */
      const tangent = path.curve.getTangentAt(vehicle.progress);
      tempQuaternion.setFromAxisAngle(upVector, headingFromVector(tangent));

      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      meshRef.current!.setMatrixAt(activeCount, tempMatrix);

      // Set color for this instance
      const colorIndex = i % config.colors.length;
      meshRef.current!.setColorAt(activeCount, new THREE.Color(config.colors[colorIndex]));

      activeCount++;
    });

    if (meshRef.current) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      meshRef.current.count = activeCount;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      // Allocated for the whole pool; `count` is set each frame to the number
      // of active vehicles, so the rate control costs no reallocation.
      args={[geometry, undefined, MAX_VEHICLES]}
      castShadow
    >
      <meshStandardMaterial
        metalness={0.6}
        roughness={0.4}
        vertexColors={true}
      />
    </instancedMesh>
  );
}

export function InstancedVehicles({ locations, roads }: InstancedVehiclesProps) {
  const { timeOfDay, trafficRate } = useCityStore();

  // Same network the road ribbons are drawn from, including bridge elevation.
  const network = useRoadNetwork(locations, roads);

  /*
    Journeys, not roads. Each path runs from one building to another, so where a
    building stands decides which roads carry its traffic — previously every
    road got the same share regardless.

    Routes come from the equilibrium assignment rather than the free-flow
    shortest path, so vehicles visibly avoid a road once it is full and a
    junction change redirects them.
  */
  const assignment = useAssignment(locations, roads);
  const trafficPaths = useMemo(
    () => tripsToDrivablePaths(assignment.trips, network, locations),
    [assignment, network, locations]
  );

  /*
    How many vehicles to show. Previously a hard-coded 60/15/25 regardless of
    how large the city was; now derived from occupant demand so adding
    buildings — or floors, via the design editor — puts more traffic on the
    roads, scaled by the user's rate control.
  */
  const demand = useMemo(
    () => computeTrafficDemand(locations, roads, timeOfDay, trafficRate),
    [locations, roads, timeOfDay, trafficRate]
  );

  /*
    Vehicle pool. Sized to MAX_VEHICLES and kept stable across demand changes:
    the instanced mesh allocates for the pool once, and `active` decides how
    many are drawn. Rebuilding this array on every slider tick would teleport
    every vehicle back to a new random position.
  */
  const vehiclePool = useMemo(() => {
    const data: Record<string, VehicleData[]> = {};

    Object.entries(VEHICLE_CONFIGS).forEach(([type, config]) => {
      const [slow, fast] = config.speedFactor;
      data[type] = Array.from({ length: MAX_VEHICLES }, (_, i) => ({
        // Seeded from the flow distribution so the first frame already shows
        // busy movements carrying more vehicles than quiet ones.
        pathIndex: sampleByFlow(trafficPaths, Math.random()),
        progress: Math.random(),
        speedFactor: slow + Math.random() * (fast - slow),
        color: config.colors[i % config.colors.length],
        active: false
      }));
    });

    return data;
  }, [trafficPaths]);

  // Flip the active flags to match current demand, in place.
  const vehicleData = useMemo(() => {
    const counts: Record<string, number> = {
      cars: demand.byType.cars,
      buses: demand.byType.buses,
      trucks: demand.byType.trucks
    };

    Object.entries(vehiclePool).forEach(([type, pool]) => {
      const wanted = counts[type] ?? 0;
      pool.forEach((v, i) => { v.active = i < wanted; });
    });

    return vehiclePool;
  }, [vehiclePool, demand]);

  if (trafficPaths.length === 0 || demand.vehicles === 0) return null;

  return (
    <group name="instanced-vehicles">
      {Object.entries(VEHICLE_CONFIGS).map(([type, config]) => (
        <InstancedVehicleType
          key={type}
          type={type}
          config={config}
          vehicleData={vehicleData[type] || []}
          trafficPaths={trafficPaths}
        />
      ))}
    </group>
  );
}