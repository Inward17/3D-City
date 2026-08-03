import { useMemo, useEffect } from 'react';
import { useCityStore } from '../../store/cityStore';
import { BufferGeometry, Vector3 } from 'three';
import { Location, Road } from '../../types/city';
import { createRoadRibbon, createCentreLine } from '../../utils/roadGeometry';
import { useRoadNetwork } from '../../hooks/useRoadNetwork';
import { useAssignment } from '../../hooks/useAssignment';
import { congestionColour, worstSaturationByRoad } from '../../utils/assignment';
import { Crossing } from '../../utils/roadCrossings';
import { JunctionsLayer } from './Junctions';
import { ROAD_WIDTH, ROAD_SURFACE_Y, ROAD_MARKING_Y, PAVEMENT_WIDTH } from '../../utils/scale';

interface RoadsLayerProps {
  locations: Location[];
  roads: Road[];
}

/** Tarmac and kerb colours for the current weather. */
function surfaceColours(weather: string) {
  return {
    tarmac: weather === 'snow' ? '#5b6472' : '#2b3038',
    kerb: weather === 'snow' ? '#c9d3dd' : '#6b7280',
    roughness: weather === 'rain' ? 0.25 : 0.85,
    metalness: weather === 'rain' ? 0.5 : 0.05
  };
}

function RoadMesh({
  road, path, saturation
}: { road: Road; path: Vector3[]; saturation: number | null }) {
  const { weather } = useCityStore();

  const { surface, markings, pavement } = useMemo(() => {
    if (path.length < 2) {
      return { surface: null, markings: null, pavement: null };
    }

    const width = ROAD_WIDTH[road.type];
    // `null` height means "use each point's own y", so a road that has been
    // lifted over a crossing carries its deck profile into the geometry.
    return {
      surface: createRoadRibbon(path, width, null),
      markings: road.type === 'residential' ? null : createCentreLine(path, ROAD_MARKING_Y - ROAD_SURFACE_Y),
      pavement: createRoadRibbon(
        path.map(p => new Vector3(p.x, p.y - 0.03, p.z)),
        width + PAVEMENT_WIDTH * 2,
        null
      )
    };
  }, [path, road.type]);

  // Generated geometry isn't garbage collected with the component.
  useEffect(() => () => {
    surface?.dispose();
    markings?.dispose();
    pavement?.dispose();
  }, [surface, markings, pavement]);

  if (!surface) return null;

  const c = surfaceColours(weather);

  /*
    With the congestion overlay on, the tarmac is banded by how much of the
    road's capacity is in use — the way a traffic study is presented. The
    surface is deliberately flattened to matte here so the banding reads as
    data rather than as wet asphalt.
  */
  const tarmac = saturation === null ? c.tarmac : congestionColour(saturation);

  return (
    <group>
      <mesh geometry={pavement as BufferGeometry} receiveShadow>
        <meshStandardMaterial color={c.kerb} roughness={0.95} metalness={0} />
      </mesh>

      <mesh geometry={surface} receiveShadow castShadow>
        <meshStandardMaterial
          color={tarmac}
          roughness={saturation === null ? c.roughness : 0.9}
          metalness={saturation === null ? c.metalness : 0}
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

/**
 * Piers and parapets for a bridged crossing.
 *
 * The deck itself is part of the road ribbon (the road's own points were raised
 * by elevatePath); this adds the structure that makes it read as a bridge
 * rather than a road inexplicably floating in the air.
 */
function BridgeStructure({ crossing, path }: { crossing: Crossing; path: Vector3[] }) {
  const { piers, parapets } = useMemo(() => {
    // Points that are meaningfully above grade form the span.
    const raised = path.filter(p => p.y > ROAD_SURFACE_Y + 0.5);
    if (raised.length < 2) return { piers: [], parapets: [] };

    // Two piers, set in from the ends of the raised section.
    const pick = [raised[Math.floor(raised.length * 0.22)], raised[Math.floor(raised.length * 0.78)]];

    return {
      piers: pick.filter(Boolean).map(p => ({
        position: [p.x, p.y / 2, p.z] as [number, number, number],
        height: p.y
      })),
      parapets: raised
    };
  }, [path]);

  if (piers.length === 0) return null;

  const half = crossing.width / 2;

  return (
    <group>
      {piers.map((pier, i) => (
        <group key={i} position={pier.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3.2, pier.height, 3.2]} />
            <meshStandardMaterial color="#8a8f96" roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Pier cap spreading under the deck */}
          <mesh position={[0, pier.height / 2 - 0.3, 0]} castShadow>
            <boxGeometry args={[crossing.width * 0.8, 0.6, 4.2]} />
            <meshStandardMaterial color="#7c828a" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Parapet on each side of the deck */}
      {[-1, 1].map(side => (
        <group key={side}>
          {parapets.map((p, i) => {
            if (i === 0) return null;
            const prev = parapets[i - 1];
            const dx = p.x - prev.x;
            const dz = p.z - prev.z;
            const len = Math.hypot(dx, dz);
            if (len < 0.01) return null;

            const angle = Math.atan2(dx, dz);
            const nx = (dz / len) * half * side;
            const nz = (-dx / len) * half * side;

            return (
              <mesh
                key={i}
                position={[(p.x + prev.x) / 2 + nx, (p.y + prev.y) / 2 + 0.55, (p.z + prev.z) / 2 + nz]}
                rotation={[0, angle, 0]}
                castShadow
              >
                <boxGeometry args={[0.25, 1.1, len]} />
                <meshStandardMaterial color="#b9bfc6" roughness={0.8} metalness={0.1} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

export function RoadsLayer({ locations, roads }: RoadsLayerProps) {

  /*
    Route every road around the buildings, then look for places two roads cross
    mid-span and lift one of them onto a bridge. Both passes have to happen here
    rather than inside each road, because a crossing is a property of the pair.
  */
  const { roads: routed, crossings } = useRoadNetwork(locations, roads);

  // Volume/capacity per road, for the congestion overlay. Both directions
  // collapse to the worse of the two: a road is a problem if either way is.
  const showCongestion = useCityStore(s => s.showCongestion);
  const assignment = useAssignment(locations, roads);
  const saturation = useMemo(
    () => (showCongestion ? worstSaturationByRoad(assignment) : null),
    [showCongestion, assignment]
  );

  return (
    <>
      {routed.map(entry => (
        <RoadMesh
          key={`road-${entry.road.id}`}
          road={entry.road}
          path={entry.path}
          saturation={saturation ? saturation.get(entry.road.id) ?? 0 : null}
        />
      ))}

      {crossings.map((crossing, i) => {
        const carrier = routed.find(r => r.road.id === crossing.overId);
        if (!carrier) return null;
        return (
          <BridgeStructure
            key={`bridge-${crossing.overId}-${i}`}
            crossing={crossing}
            path={carrier.path}
          />
        );
      })}

      <JunctionsLayer crossings={crossings} />
    </>
  );
}

