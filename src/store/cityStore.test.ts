import { describe, it, expect, beforeEach } from 'vitest';
import { useCityStore } from './cityStore';
import { localRepo } from '../lib/localRepo';
import { Location, Road } from '../types/city';
import { getEffectiveDimensions } from '../utils/buildingDimensions';

const loc = (over: Partial<Location> = {}): Location => ({
  id: 'l1',
  name: 'Test',
  type: 'Building',
  position: [0, 0, 0],
  description: '',
  ...over
});

/** Reset the store between tests; zustand keeps state across imports. */
function resetStore() {
  useCityStore.setState({
    locations: [],
    roads: [],
    selectedLocation: null,
    currentProjectId: null,
    activeSectors: [],
    isPlacingBuilding: false,
    isPlacingRoute: false,
    buildingTypeToPlace: null,
    routeStartId: null,
    roadTypeToPlace: 'secondary',
    cameraController: null
  });
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe('addBuilding', () => {
  it('does nothing when no building type is selected', async () => {
    await useCityStore.getState().addBuilding([0, 0, 0], 'Nothing');
    expect(useCityStore.getState().locations).toHaveLength(0);
  });

  it('adopts the first active sector as its zone', async () => {
    // Without a zone the viewer filters the new building straight back out,
    // which is why placement appeared to do nothing.
    useCityStore.setState({
      buildingTypeToPlace: 'Hotel',
      activeSectors: ['commercial', 'healthcare']
    });

    await useCityStore.getState().addBuilding([10, 0, 20], 'New Hotel');

    const [created] = useCityStore.getState().locations;
    expect(created.zone).toBe('commercial');
  });

  it('leaves the zone undefined when no sectors are active', async () => {
    useCityStore.setState({ buildingTypeToPlace: 'Hotel', activeSectors: [] });
    await useCityStore.getState().addBuilding([0, 0, 0], 'Orphan');
    expect(useCityStore.getState().locations[0].zone).toBeUndefined();
  });

  it('applies a colour based on the building type', async () => {
    useCityStore.setState({ buildingTypeToPlace: 'Hospital', activeSectors: ['healthcare'] });
    await useCityStore.getState().addBuilding([0, 0, 0], 'Clinic');
    expect(useCityStore.getState().locations[0].color).toBe('#f87171');
  });

  it('clears placement mode so a double click cannot place twice', async () => {
    useCityStore.setState({
      buildingTypeToPlace: 'Shop',
      isPlacingBuilding: true,
      activeSectors: ['commercial']
    });

    await useCityStore.getState().addBuilding([0, 0, 0], 'Shop');

    const state = useCityStore.getState();
    expect(state.isPlacingBuilding).toBe(false);
    expect(state.buildingTypeToPlace).toBeNull();
  });

  it('persists through the repository when a project is open', async () => {
    const project = await localRepo.createProject({
      name: 'P', description: '', model_type: 'planning', sectors: ['commercial'], theme: 'default'
    });
    useCityStore.setState({
      currentProjectId: project.id,
      buildingTypeToPlace: 'Hotel',
      activeSectors: ['commercial']
    });

    await useCityStore.getState().addBuilding([30, 0, 40], 'Stored Hotel');

    const { locations } = await localRepo.getCityData(project.id);
    expect(locations.map(l => l.name)).toContain('Stored Hotel');
  });
});

describe('pickRouteEndpoint', () => {
  const a = loc({ id: 'a', position: [0, 0, 0] });
  const b = loc({ id: 'b', position: [300, 0, 300] });

  beforeEach(() => {
    useCityStore.setState({ locations: [a, b], roads: [], isPlacingRoute: true });
  });

  it('records the first click as the start point', async () => {
    await useCityStore.getState().pickRouteEndpoint('a');
    expect(useCityStore.getState().routeStartId).toBe('a');
    expect(useCityStore.getState().roads).toHaveLength(0);
  });

  it('creates a road on the second click', async () => {
    await useCityStore.getState().pickRouteEndpoint('a');
    await useCityStore.getState().pickRouteEndpoint('b');

    const { roads } = useCityStore.getState();
    expect(roads).toHaveLength(1);
    expect(roads[0].from).toBe('a');
    expect(roads[0].to).toBe('b');
  });

  it('computes the distance from the two positions', async () => {
    await useCityStore.getState().pickRouteEndpoint('a');
    await useCityStore.getState().pickRouteEndpoint('b');
    // sqrt(300^2 + 300^2) = 424.26
    expect(useCityStore.getState().roads[0].distance).toBe(424);
  });

  it('uses the selected road class', async () => {
    useCityStore.setState({ roadTypeToPlace: 'main' });
    await useCityStore.getState().pickRouteEndpoint('a');
    await useCityStore.getState().pickRouteEndpoint('b');
    expect(useCityStore.getState().roads[0].type).toBe('main');
  });

  it('chains from the second building so a run can continue', async () => {
    await useCityStore.getState().pickRouteEndpoint('a');
    await useCityStore.getState().pickRouteEndpoint('b');
    expect(useCityStore.getState().routeStartId).toBe('b');
  });

  it('cancels the pick when the same building is clicked twice', async () => {
    await useCityStore.getState().pickRouteEndpoint('a');
    await useCityStore.getState().pickRouteEndpoint('a');

    expect(useCityStore.getState().routeStartId).toBeNull();
    expect(useCityStore.getState().roads).toHaveLength(0);
  });

  it('refuses to duplicate an existing connection in either direction', async () => {
    useCityStore.setState({
      roads: [{ id: 'r1', from: 'a', to: 'b', distance: 424, type: 'main' } as Road]
    });

    await useCityStore.getState().pickRouteEndpoint('b');
    await useCityStore.getState().pickRouteEndpoint('a');

    expect(useCityStore.getState().roads).toHaveLength(1);
    expect(useCityStore.getState().routeStartId).toBeNull();
  });

  it('ignores an endpoint that is not a known building', async () => {
    await useCityStore.getState().pickRouteEndpoint('a');
    await useCityStore.getState().pickRouteEndpoint('ghost');

    expect(useCityStore.getState().roads).toHaveLength(0);
    expect(useCityStore.getState().routeStartId).toBeNull();
  });

  it('persists the road through the repository', async () => {
    const project = await localRepo.createProject({
      name: 'P', description: '', model_type: 'planning', sectors: [], theme: 'default'
    });
    useCityStore.setState({ currentProjectId: project.id, locations: [a, b], roads: [] });

    await useCityStore.getState().pickRouteEndpoint('a');
    await useCityStore.getState().pickRouteEndpoint('b');

    const { roads } = await localRepo.getCityData(project.id);
    expect(roads).toHaveLength(1);
    expect(roads[0].distance).toBe(424);
  });
});

describe('setIsPlacingRoute', () => {
  it('clears a half-finished pick when leaving route mode', async () => {
    useCityStore.setState({ locations: [loc({ id: 'a' })], isPlacingRoute: true });
    await useCityStore.getState().pickRouteEndpoint('a');
    expect(useCityStore.getState().routeStartId).toBe('a');

    useCityStore.getState().setIsPlacingRoute(false);
    expect(useCityStore.getState().routeStartId).toBeNull();
  });
});

describe('removeLocation', () => {
  const a = loc({ id: 'a' });
  const b = loc({ id: 'b', position: [100, 0, 0] });
  const c = loc({ id: 'c', position: [200, 0, 0] });

  beforeEach(() => {
    useCityStore.setState({
      locations: [a, b, c],
      roads: [
        { id: 'r1', from: 'a', to: 'b', distance: 100, type: 'main' },
        { id: 'r2', from: 'b', to: 'c', distance: 100, type: 'main' }
      ]
    });
  });

  it('removes the building', async () => {
    await useCityStore.getState().removeLocation('a');
    expect(useCityStore.getState().locations.map(l => l.id)).toEqual(['b', 'c']);
  });

  it('removes roads attached to it and leaves the rest', async () => {
    await useCityStore.getState().removeLocation('a');
    const { roads } = useCityStore.getState();
    expect(roads.map(r => r.id)).toEqual(['r2']);
  });

  it('never leaves a road pointing at a missing building', async () => {
    await useCityStore.getState().removeLocation('b');
    const { locations, roads } = useCityStore.getState();
    const ids = new Set(locations.map(l => l.id));
    for (const road of roads) {
      expect(ids.has(road.from) && ids.has(road.to)).toBe(true);
    }
  });

  it('clears the selection when the selected building is deleted', async () => {
    useCityStore.setState({ selectedLocation: a });
    await useCityStore.getState().removeLocation('a');
    expect(useCityStore.getState().selectedLocation).toBeNull();
  });

  it('keeps a different selection intact', async () => {
    useCityStore.setState({ selectedLocation: c });
    await useCityStore.getState().removeLocation('a');
    expect(useCityStore.getState().selectedLocation?.id).toBe('c');
  });

  it('clears the route start when that building is deleted', async () => {
    useCityStore.setState({ routeStartId: 'a' });
    await useCityStore.getState().removeLocation('a');
    expect(useCityStore.getState().routeStartId).toBeNull();
  });
});

describe('camera preset intent', () => {
  it('records the preset even with no camera rig mounted', () => {
    // AddMenu's aerial gate and the toolbar highlight both key off this, and
    // it used to be written only by a rig that the UI never called.
    useCityStore.getState().animateToPreset('aerial');
    expect(useCityStore.getState().cameraState.preset).toBe('aerial');
  });

  it('delegates to the registered controller', () => {
    const calls: string[] = [];
    useCityStore.getState().registerCameraController({
      animateToPreset: (p) => calls.push(p),
      flyToLocation: () => calls.push('fly')
    });

    useCityStore.getState().animateToPreset('cinematic');
    useCityStore.getState().flyToCameraLocation([1, 2, 3]);

    expect(calls).toEqual(['cinematic', 'fly']);
  });

  it('does not throw when no controller is registered', () => {
    expect(() => useCityStore.getState().flyToCameraLocation([0, 0, 0])).not.toThrow();
  });
});

describe('framing a selected building', () => {
  /** Where the camera and its orbit target end up when `location` is selected. */
  function frame(location: Location) {
    let seen: { position: number[]; offset?: number[] } | null = null;
    useCityStore.getState().registerCameraController({
      animateToPreset: () => {},
      flyToLocation: (position, offset) => { seen = { position, offset }; }
    });

    useCityStore.getState().flyToLocation(location);
    useCityStore.getState().registerCameraController(null);

    const { position, offset } = seen!;
    return {
      target: position,
      // Camera sits at target + offset; only the horizontal reach matters for
      // "am I inside the building".
      horizontal: Math.hypot(offset![0], offset![2]),
      height: position[1] + offset![1]
    };
  }

  const building = (over: Partial<Location> = {}): Location => ({
    id: 'b', name: 'b', type: 'Building', position: [0, 0, 0],
    description: '', zone: 'commercial', ...over
  });

  it('stands outside the footprint rather than inside it', () => {
    // The old fixed [10, 10, 10] offset sat well within a 40 m-wide tower.
    for (const width of [8, 20, 40, 80]) {
      const b = building({ design: { width, depth: width } });
      const { horizontal } = frame(b);
      expect(horizontal, `camera inside a ${width} m building`)
        .toBeGreaterThan(Math.hypot(width, width) / 2);
    }
  });

  it('backs off further for a taller building', () => {
    const low = frame(building({ design: { floors: 1 } })).horizontal;
    const tall = frame(building({ design: { floors: 40 } })).horizontal;
    expect(tall).toBeGreaterThan(low);
  });

  it('looks at the middle of the building, not the ground', () => {
    const b = building({ design: { floors: 20 } });
    const { target } = frame(b);
    expect(target[1]).toBeGreaterThan(0);
    expect(target[1]).toBeLessThan(getEffectiveDimensions(b).height);
  });

  it('keeps the camera above the target', () => {
    expect(frame(building({ design: { floors: 30 } })).height)
      .toBeGreaterThan(0);
  });

  it('stays within the orbit controls’ range', () => {
    // controls.minDistance = 8, maxDistance = 1600.
    for (const floors of [1, 60]) {
      const { horizontal } = frame(building({ design: { floors } }));
      expect(horizontal).toBeGreaterThan(8);
      expect(horizontal).toBeLessThan(1600);
    }
  });
});
