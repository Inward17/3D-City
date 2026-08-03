import { Location, Road } from '../types/city';
import { buildingCapacity, occupancyFactor } from './cityMetrics';

/**
 * How many vehicles the city should be showing.
 *
 * Traffic used to be a fixed 100 vehicles regardless of whether the map held
 * three buildings or three hundred. This derives it from the same capacity
 * model the analytics use, so a bigger city — or a building given more floors
 * in the design editor — actually puts more cars on the road.
 *
 * The chain is: occupants present at this hour -> trips generated -> vehicles
 * on screen, capped so the instanced meshes stay within their pool.
 */

/**
 * Occupants present per vehicle on the road at any given moment.
 *
 * Not everyone in a building is travelling at once — trips cluster around
 * arrival and departure. A ratio of 1:40 keeps a mid-sized city comfortably
 * under MAX_VEHICLES so the rate slider still has room to move; at 1:12 the
 * cap was reached by about eleven office blocks and the control felt dead.
 */
export const OCCUPANTS_PER_VEHICLE = 40;

/** Hard ceiling; matches the instanced mesh pool size. */
export const MAX_VEHICLES = 240;

/** Split of the vehicle budget across the three body types. */
export const VEHICLE_MIX = { cars: 0.66, buses: 0.12, trucks: 0.22 } as const;

export interface TrafficDemand {
  /** Occupants present across the city at this hour. */
  occupants: number;
  /** Vehicles before the user's multiplier and the cap. */
  baseVehicles: number;
  /** Final vehicle count actually rendered. */
  vehicles: number;
  /** Per-type counts, summing to `vehicles`. */
  byType: { cars: number; buses: number; trucks: number };
  /** True when the cap clipped the demand. */
  capped: boolean;
}

/**
 * @param rate user multiplier, 0 = no traffic, 1 = modelled demand, 2 = double
 */
export function computeTrafficDemand(
  locations: Location[],
  roads: Road[],
  timeOfDay: number,
  rate: number
): TrafficDemand {
  // Nothing to drive on.
  if (roads.length === 0) {
    return {
      occupants: 0,
      baseVehicles: 0,
      vehicles: 0,
      byType: { cars: 0, buses: 0, trucks: 0 },
      capped: false
    };
  }

  const hour = Math.floor(timeOfDay);

  const occupants = locations.reduce(
    (sum, l) => sum + buildingCapacity(l) * occupancyFactor(l.type, hour, l.zone),
    0
  );

  const baseVehicles = Math.round(occupants / OCCUPANTS_PER_VEHICLE);
  const scaled = Math.round(baseVehicles * Math.max(0, rate));
  const vehicles = Math.min(scaled, MAX_VEHICLES);

  // Give buses and trucks a floor of 1 whenever there's meaningful traffic, so
  // a small city isn't rendered as cars only.
  const cars = Math.round(vehicles * VEHICLE_MIX.cars);
  const buses = vehicles > 8 ? Math.max(1, Math.round(vehicles * VEHICLE_MIX.buses)) : 0;
  const trucks = vehicles > 4 ? Math.max(1, vehicles - cars - buses) : 0;

  return {
    occupants: Math.round(occupants),
    baseVehicles,
    vehicles,
    byType: {
      cars: Math.max(0, cars),
      buses: Math.max(0, buses),
      trucks: Math.max(0, trucks)
    },
    capped: scaled > MAX_VEHICLES
  };
}
