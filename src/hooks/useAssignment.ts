import { useMemo } from 'react';
import { Location, Road } from '../types/city';
import { useCityStore } from '../store/cityStore';
import { useRoadNetwork } from './useRoadNetwork';
import { assignCity, Assignment, Weather } from '../utils/assignment';
import { OCCUPANTS_PER_VEHICLE } from '../utils/trafficDemand';

/**
 * The city's traffic at equilibrium, resolved once for whoever needs it.
 *
 * Same reasoning as useRoadNetwork: several consumers want this — the vehicles
 * driving the routes, the road ribbons coloured by how full they are, the
 * junction panel comparing what each style would cost — and they must all see
 * the same answer. Solving it separately per component would also be wasteful,
 * since an assignment costs far more than a road layout.
 */
let cache: {
  network: unknown;
  locations: Location[];
  hour: number;
  rate: number;
  weather: Weather;
  result: Assignment;
} | null = null;

export function useAssignment(locations: Location[], roads: Road[]): Assignment {
  const network = useRoadNetwork(locations, roads);
  const timeOfDay = useCityStore(s => s.timeOfDay);
  const trafficRate = useCityStore(s => s.trafficRate);
  const weather = useCityStore(s => s.weather);
  const hour = Math.floor(timeOfDay);

  return useMemo(() => {
    if (
      cache &&
      cache.network === network &&
      cache.locations === locations &&
      cache.hour === hour &&
      cache.rate === trafficRate &&
      cache.weather === weather
    ) {
      return cache.result;
    }

    const result = assignCity(
      network, locations, hour, OCCUPANTS_PER_VEHICLE, trafficRate, weather
    );
    cache = { network, locations, hour, rate: trafficRate, weather, result };
    return result;
  }, [network, locations, hour, trafficRate, weather]);
}
