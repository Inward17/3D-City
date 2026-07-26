import { useMemo, useEffect } from 'react';
import { useCityStore } from '../../store/cityStore';
import { BufferGeometry } from 'three';
import { Location, Road } from '../../types/city';
import { createRoadRibbon, createCentreLine } from '../../utils/roadGeometry';
import { routeRoad } from '../../utils/roadRouting';
import { ROAD_WIDTH, ROAD_SURFACE_Y, ROAD_MARKING_Y, PAVEMENT_WIDTH } from '../../utils/scale';

interface RoadsLayerProps {
  locations: Location[];
  roads: Road[];
}

function RoadMesh({
  road,
  from,
  to,
  obstacles
}: {
  road: Road;
  from: Location;
  to: Location;
  obstacles: Location[];
}) {
  const { weather } = useCityStore();

  const { surface, markings, pavement } = useMemo(() => {
    /*
      The centre-line is routed rather than drawn straight from centre to
      centre: it starts at each building's edge and bends around anything in
      between. The decorative per-road "wobble" that used to live here was
      removed — it made roads meander for no reason and, worse, meant the
      ribbons and the vehicle paths described different curves.
    */
    const smooth = routeRoad(from, to, road.type, { obstacles });
    if (smooth.length < 2) {
      return { surface: null, markings: null, pavement: null };
    }

    const width = ROAD_WIDTH[road.type];

    return {
      surface: createRoadRibbon(smooth, width, ROAD_SURFACE_Y),
      // Only wide roads get a centre line, as in reality.
      markings: road.type === 'residential'
        ? null
        : createCentreLine(smooth, ROAD_MARKING_Y),
      // Footway either side, drawn as one wider strip beneath the carriageway.
      pavement: createRoadRibbon(smooth, width + PAVEMENT_WIDTH * 2, ROAD_SURFACE_Y - 0.03)
    };
  }, [from, to, road.type, obstacles]);

  // Generated geometry isn't garbage collected with the component.
  useEffect(() => {
    return () => {
      surface?.dispose();
      markings?.dispose();
      pavement?.dispose();
    };
  }, [surface, markings, pavement]);

  if (!surface) return null;

  const tarmac = weather === 'snow' ? '#5b6472' : '#2b3038';
  const kerb = weather === 'snow' ? '#c9d3dd' : '#6b7280';

  return (
    <group>
      <mesh geometry={pavement as BufferGeometry} receiveShadow>
        <meshStandardMaterial color={kerb} roughness={0.95} metalness={0} />
      </mesh>

      <mesh geometry={surface} receiveShadow>
        <meshStandardMaterial
          color={tarmac}
          roughness={weather === 'rain' ? 0.25 : 0.85}
          metalness={weather === 'rain' ? 0.5 : 0.05}
        />
      </mesh>

      {markings && (
        <mesh geometry={markings}>
          <meshStandardMaterial
            color="#e8e4d9"
            roughness={0.7}
            emissive="#3a3730"
            emissiveIntensity={0.2}
          />
        </mesh>
      )}
    </group>
  );
}

/** Junction disc where several main roads meet. */
function Junction({ position, radius }: { position: [number, number, number]; radius: number }) {
  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_SURFACE_Y + 0.01, 0]} receiveShadow>
        <circleGeometry args={[radius, 32]} />
        <meshStandardMaterial color="#2b3038" roughness={0.85} />
      </mesh>
      {/* Central island, sized so a bus can still track around it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_SURFACE_Y + 0.06, 0]}>
        <circleGeometry args={[radius * 0.35, 24]} />
        <meshStandardMaterial color="#3f8f52" roughness={0.95} />
      </mesh>
    </group>
  );
}

export function RoadsLayer({ locations, roads }: RoadsLayerProps) {
  const byId = useMemo(
    () => new Map(locations.map(l => [l.id, l])),
    [locations]
  );

  return (
    <>
      {roads.map(road => {
        const from = byId.get(road.from);
        const to = byId.get(road.to);
        if (!from || !to) return null;
        return (
          <RoadMesh
            key={`road-${road.id}`}
            road={road}
            from={from}
            to={to}
            obstacles={locations}
          />
        );
      })}

      {locations.map(location => {
        const mainRoads = roads.filter(
          r => (r.from === location.id || r.to === location.id) && r.type === 'main'
        );
        if (mainRoads.length < 2) return null;
        return (
          <Junction
            key={`junction-${location.id}`}
            position={location.position}
            radius={ROAD_WIDTH.main * 0.9}
          />
        );
      })}
    </>
  );
}
