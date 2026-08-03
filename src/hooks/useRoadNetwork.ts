import { useMemo } from 'react';
import { Location, Road } from '../types/city';
import { useCityStore } from '../store/cityStore';
import { buildRoadNetwork, RoadNetwork } from '../utils/roadNetwork';

/**
 * The road network, resolved once for whoever needs it.
 *
 * Every consumer must see the *same* geometry. This has gone wrong three times
 * now, each time because two places built the network independently:
 *
 *   1. the ribbons had a decorative wobble while vehicles drove straight,
 *   2. the two were recomputed separately and drifted,
 *   3. the vehicle layer omitted the crossing styles argument, so it resolved
 *      every crossing as at-grade and drove cars underneath a raised bridge
 *      deck that the road layer had lifted.
 *
 * Reading the styles from the store here means a caller cannot forget them.
 */

/*
  Routing the whole network costs a few milliseconds, and useMemo is per
  component instance — so each call site paid it again on every design change.
  With four consumers that was most of a frame budget spent recomputing an
  identical answer. One shared slot, compared by reference (the store hands out
  stable arrays between updates), collapses them back to a single run.
*/
let cache: {
  locations: Location[];
  roads: Road[];
  styles: Record<string, string>;
  result: RoadNetwork;
} | null = null;

export function useRoadNetwork(locations: Location[], roads: Road[]): RoadNetwork {
  const crossingStyles = useCityStore(s => s.crossingStyles);

  return useMemo(() => {
    if (
      cache &&
      cache.locations === locations &&
      cache.roads === roads &&
      cache.styles === crossingStyles
    ) {
      return cache.result;
    }

    const result = buildRoadNetwork(locations, roads, crossingStyles);
    cache = { locations, roads, styles: crossingStyles, result };
    return result;
  }, [locations, roads, crossingStyles]);
}
