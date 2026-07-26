import { Location, Road } from '../types/city';
import { getEffectiveDimensions } from './buildingDimensions';

/**
 * Derived city metrics.
 *
 * These are *model estimates*, not measurements — but they are computed from
 * the actual scene (building geometry, types, zones and the road graph) and are
 * fully deterministic. The previous implementation generated usage, population
 * and efficiency with Math.random(), so the numbers changed on every render and
 * carried no information at all.
 *
 * Assumptions are stated as named constants so they can be argued with.
 */

/** Share of gross floor area that is actually occupiable (cores, plant, walls). */
const NET_TO_GROSS = 0.8;

/**
 * Square metres of usable floor area per occupant, by building type.
 * Loosely follows common space-planning rules of thumb.
 */
const AREA_PER_OCCUPANT: Record<string, number> = {
  Building: 12,   // open-plan office
  Hospital: 30,   // wards, theatres, circulation
  School: 8,      // classrooms
  Hotel: 25,      // rooms plus back of house
  Library: 12,
  Museum: 20,
  Shop: 15,
  Restaurant: 8,
  Cafe: 8,
  Park: 0         // handled separately: parks have no floor area
};

/** Peak visitors per hectare for open space, used instead of floor area. */
const PARK_VISITORS_PER_HECTARE = 60;

/**
 * Normalised occupancy by hour (0..1) for each building type. Deterministic;
 * shared with the per-building chart in LocationInfo so the two agree.
 */
export function occupancyFactor(type: Location['type'], hour: number): number {
  const bell = (peak: number, width: number) =>
    Math.max(0, 1 - Math.abs(hour - peak) / width);

  switch (type) {
    case 'Building':
      return hour >= 8 && hour <= 18 ? 0.35 + 0.6 * bell(13, 7) : 0.06;
    case 'School':
      return hour >= 8 && hour <= 16 ? 0.5 + 0.5 * bell(12, 5) : 0.04;
    case 'Hospital':
      // Never empties; day shift busier than night.
      return 0.55 + 0.35 * bell(14, 9);
    case 'Hotel':
      // Inverse of the office curve: fullest overnight.
      return hour >= 22 || hour <= 7 ? 0.85 : 0.35;
    case 'Restaurant':
      return Math.max(bell(13, 2), bell(20, 3)) * 0.95 + 0.05;
    case 'Cafe':
      return Math.max(bell(9, 2.5), bell(15, 3)) * 0.85 + 0.08;
    case 'Shop':
      return hour >= 9 && hour <= 20 ? 0.3 + 0.6 * bell(15, 6) : 0.03;
    case 'Library':
      return hour >= 9 && hour <= 19 ? 0.25 + 0.5 * bell(15, 5) : 0.02;
    case 'Museum':
      return hour >= 10 && hour <= 17 ? 0.3 + 0.55 * bell(14, 4) : 0.02;
    case 'Park':
      return hour >= 6 && hour <= 21 ? 0.2 + 0.7 * bell(16, 7) : 0.03;
    default:
      return 0.3;
  }
}

/**
 * Peak occupant capacity for a single building.
 *
 * Uses an explicit population if one has been set, otherwise estimates from the
 * *effective* dimensions — so resizing a building or adding floors in the design
 * editor moves the capacity and every figure derived from it.
 */
export function derivedCapacity(location: Location): number {
  return buildingCapacity({ ...location, design: { ...location.design, population: undefined } });
}
export function buildingCapacity(location: Location): number {
  // An explicit population set in the design editor wins over the estimate.
  const override = location.design?.population;
  if (override != null && Number.isFinite(override) && override >= 0) {
    return Math.round(override);
  }

  if (location.type === 'Park') {
    // Park footprint in the scene is a 30-unit radius disc.
    const hectares = (Math.PI * 30 * 30) / 10000;
    return Math.round(hectares * PARK_VISITORS_PER_HECTARE);
  }

  const perOccupant = AREA_PER_OCCUPANT[location.type] ?? 15;
  if (perOccupant <= 0) return 0;

  const dims = getEffectiveDimensions(location);
  const footprint = dims.width * dims.depth;
  const usableArea = footprint * dims.floors * NET_TO_GROSS;

  return Math.round(usableArea / perOccupant);
}

export interface SectorMetrics {
  sector: string;
  label: string;
  buildings: number;
  capacity: number;
  /** Occupants at the currently selected hour. */
  occupancyNow: number;
  /** occupancyNow as a percentage of capacity. */
  utilisation: number;
  /** Roads with at least one endpoint in this sector. */
  roads: number;
  /** Buildings in this sector with no road connection at all. */
  isolated: number;
  /** Mean road connections per building. */
  connectivity: number;
  color: string;
}

export interface CityMetrics {
  sectorData: SectorMetrics[];
  hourlyData: { hour: string; occupancy: number }[];
  totals: {
    totalBuildings: number;
    totalCapacity: number;
    occupancyNow: number;
    utilisation: number;
    totalRoads: number;
    networkLength: number;
    connectedShare: number;
    isolatedBuildings: number;
    averageConnectivity: number;
  };
}

const PALETTE = [
  '#38bdf8', '#f87171', '#34d399', '#fbbf24',
  '#a78bfa', '#f472b6', '#22d3ee', '#a3e635'
];

export function computeCityMetrics(
  locations: Location[],
  roads: Road[],
  activeSectors: string[],
  timeOfDay: number
): CityMetrics {
  const hour = Math.floor(timeOfDay);

  // Road degree per building — a real graph measure, not an invented score.
  const degree = new Map<string, number>();
  locations.forEach(l => degree.set(l.id, 0));
  roads.forEach(road => {
    if (degree.has(road.from)) degree.set(road.from, degree.get(road.from)! + 1);
    if (degree.has(road.to)) degree.set(road.to, degree.get(road.to)! + 1);
  });

  const sectorData: SectorMetrics[] = activeSectors.map((sector, index) => {
    const inSector = locations.filter(loc => loc.zone === sector);

    const capacity = inSector.reduce((sum, l) => sum + buildingCapacity(l), 0);
    const occupancyNow = inSector.reduce(
      (sum, l) => sum + buildingCapacity(l) * occupancyFactor(l.type, hour),
      0
    );

    const sectorRoads = roads.filter(road => {
      const from = locations.find(l => l.id === road.from);
      const to = locations.find(l => l.id === road.to);
      return from?.zone === sector || to?.zone === sector;
    });

    const isolated = inSector.filter(l => (degree.get(l.id) ?? 0) === 0).length;
    const totalDegree = inSector.reduce((sum, l) => sum + (degree.get(l.id) ?? 0), 0);

    return {
      sector,
      label: sector.charAt(0).toUpperCase() + sector.slice(1),
      buildings: inSector.length,
      capacity,
      occupancyNow: Math.round(occupancyNow),
      utilisation: capacity > 0 ? Math.round((occupancyNow / capacity) * 100) : 0,
      roads: sectorRoads.length,
      isolated,
      connectivity: inSector.length > 0
        ? Math.round((totalDegree / inSector.length) * 10) / 10
        : 0,
      color: PALETTE[index % PALETTE.length]
    };
  });

  // Whole-city occupancy across the day, summed from the same per-type curves.
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, '0')}:00`,
    occupancy: Math.round(
      locations.reduce((sum, l) => sum + buildingCapacity(l) * occupancyFactor(l.type, h), 0)
    )
  }));

  const totalCapacity = locations.reduce((sum, l) => sum + buildingCapacity(l), 0);
  const occupancyNow = locations.reduce(
    (sum, l) => sum + buildingCapacity(l) * occupancyFactor(l.type, hour),
    0
  );
  const networkLength = roads.reduce((sum, r) => sum + (r.distance || 0), 0);
  const connectedCount = locations.filter(l => (degree.get(l.id) ?? 0) > 0).length;
  const totalDegree = locations.reduce((sum, l) => sum + (degree.get(l.id) ?? 0), 0);

  return {
    sectorData,
    hourlyData,
    totals: {
      totalBuildings: locations.length,
      totalCapacity,
      occupancyNow: Math.round(occupancyNow),
      utilisation: totalCapacity > 0 ? Math.round((occupancyNow / totalCapacity) * 100) : 0,
      totalRoads: roads.length,
      networkLength: Math.round(networkLength),
      connectedShare: locations.length > 0
        ? Math.round((connectedCount / locations.length) * 100)
        : 0,
      isolatedBuildings: locations.length - connectedCount,
      averageConnectivity: locations.length > 0
        ? Math.round((totalDegree / locations.length) * 10) / 10
        : 0
    }
  };
}
