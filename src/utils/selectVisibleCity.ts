import { Location, Road } from '../types/city';

/**
 * Decide what the viewer actually renders for a given sector selection.
 *
 * Storage is the single source of truth, so this is a pure filter — it must not
 * merge in template data. Two rules matter:
 *
 *  - A location with no zone is user-placed and is always shown. Filtering on
 *    `activeSectors.includes(zone || '')` used to drop every freshly placed
 *    building, which is why placement looked like it did nothing.
 *  - A road is only drawn when both of its endpoints are visible, otherwise it
 *    renders as a line to nowhere.
 */
export function selectVisibleCity(
  locations: Location[],
  roads: Road[],
  activeSectors: string[]
): { locations: Location[]; roads: Road[] } {
  const visibleLocations = locations.filter(
    location => !location.zone || activeSectors.includes(location.zone)
  );

  const visibleIds = new Set(visibleLocations.map(loc => loc.id));
  const visibleRoads = roads.filter(
    road => visibleIds.has(road.from) && visibleIds.has(road.to)
  );

  return { locations: visibleLocations, roads: visibleRoads };
}
