import { create } from 'zustand';
import { Location, Road, ZoneType, BuildingDesign } from '../types/city';
import { localRepo } from '../lib/localRepo';
import * as THREE from 'three';
import type { OrbitControls } from 'three-stdlib';

export type CameraPreset = 'isometric' | 'aerial' | 'walkthrough' | 'cinematic' | 'free';

/**
 * Implemented by the in-scene camera rig (SmoothCameraControls) and registered
 * with the store on mount. The store owns the *intent* (which preset is active);
 * the controller owns the actual three.js transitions.
 */
export interface CameraController {
  animateToPreset: (preset: CameraPreset) => void;
  flyToLocation: (
    position: [number, number, number],
    offset?: [number, number, number]
  ) => void;
}

interface CameraState {
  preset: CameraPreset;
  isAnimating: boolean;
  camera: THREE.Camera | null;
  controls: OrbitControls | null;
}

/** Palette used for user-placed buildings so they don't all come out the same blue. */
const BUILDING_TYPE_COLORS: Partial<Record<Location['type'], string>> = {
  Building: '#60a5fa',
  Hospital: '#f87171',
  School: '#fbbf24',
  Library: '#a78bfa',
  Museum: '#c084fc',
  Hotel: '#38bdf8',
  Restaurant: '#fb923c',
  Cafe: '#f59e0b',
  Shop: '#34d399',
  Park: '#4ade80'
};

interface CityStore {
  selectedLocation: Location | null;
  setSelectedLocation: (location: Location | null) => void;
  locations: Location[];
  setLocations: (locations: Location[]) => void;
  roads: Road[];
  setRoads: (roads: Road[]) => void;
  timeOfDay: number;
  setTimeOfDay: (time: number | ((prev: number) => number)) => void;
  weather: 'clear' | 'rain' | 'snow';
  setWeather: (weather: 'clear' | 'rain' | 'snow') => void;
  /**
   * Multiplier on modelled traffic demand. 1 = the demand implied by the
   * buildings present; 0 clears the roads; 2 doubles it.
   */
  trafficRate: number;
  setTrafficRate: (rate: number) => void;
  showGeoMap: boolean;
  setShowGeoMap: (show: boolean) => void;
  isPlacingBuilding: boolean;
  setIsPlacingBuilding: (isPlacing: boolean) => void;
  isPlacingRoute: boolean;
  setIsPlacingRoute: (isPlacing: boolean) => void;
  buildingTypeToPlace: Location['type'] | null;
  setBuildingTypeToPlace: (type: Location['type'] | null) => void;
  addBuilding: (position: [number, number, number], name: string) => Promise<void>;
  removeLocation: (locationId: string) => Promise<void>;
  /** Apply design edits (footprint, floors, colour, roof) to a building. */
  updateLocationDesign: (locationId: string, design: Partial<BuildingDesign>) => void;
  /** Road class applied to the next route drawn. */
  roadTypeToPlace: Road['type'];
  setRoadTypeToPlace: (type: Road['type']) => void;
  /** First endpoint picked while drawing a route; null means "pick a start". */
  routeStartId: string | null;
  setRouteStartId: (id: string | null) => void;
  /** Called when a building is clicked in route mode; advances the two-step pick. */
  pickRouteEndpoint: (locationId: string) => Promise<void>;
  fetchProjectData: (
    projectId: string,
    modelType?: 'planning' | 'corporate',
    sectors?: string[]
  ) => Promise<void>;
  loading: boolean;
  /** Project currently open in the viewer; needed to persist placements. */
  currentProjectId: string | null;
  /** Sectors the viewer is showing; new buildings adopt the first of these. */
  activeSectors: string[];
  setActiveSectors: (sectors: string[]) => void;
  flyToLocation: (location: Location) => void;
  // Camera controls state
  cameraState: CameraState;
  cameraController: CameraController | null;
  setCameraRefs: (camera: THREE.Camera, controls: OrbitControls) => void;
  registerCameraController: (controller: CameraController | null) => void;
  setCameraTransitioning: (isAnimating: boolean) => void;
  animateToPreset: (preset: CameraPreset) => void;
  flyToCameraLocation: (position: [number, number, number]) => void;
}

export const useCityStore = create<CityStore>((set, get) => ({
  selectedLocation: null,
  setSelectedLocation: (location) => {
    set({ selectedLocation: location });
    // Auto fly-to when selecting a location
    if (location) {
      get().flyToLocation(location);
    }
  },
  locations: [],
  setLocations: (locations) => set({ locations }),
  roads: [],
  setRoads: (roads) => set({ roads }),
  timeOfDay: 12,
  setTimeOfDay: (time) => set((state) => ({
    timeOfDay: typeof time === 'function' ? time(state.timeOfDay) : time
  })),
  weather: 'clear',
  setWeather: (weather) => set({ weather }),
  trafficRate: 1,
  setTrafficRate: (rate) => set({ trafficRate: Math.max(0, Math.min(3, rate)) }),
  showGeoMap: false,
  setShowGeoMap: (show) => set({ showGeoMap: show }),
  isPlacingBuilding: false,
  setIsPlacingBuilding: (isPlacing) => set({ isPlacingBuilding: isPlacing }),
  isPlacingRoute: false,
  // Leaving route mode must clear any half-finished pick, or re-entering it
  // would silently continue from a stale start point.
  setIsPlacingRoute: (isPlacing) =>
    set({ isPlacingRoute: isPlacing, routeStartId: isPlacing ? null : null }),
  roadTypeToPlace: 'secondary',
  setRoadTypeToPlace: (type) => set({ roadTypeToPlace: type }),
  routeStartId: null,
  setRouteStartId: (id) => set({ routeStartId: id }),
  buildingTypeToPlace: null,
  setBuildingTypeToPlace: (type) => set({ buildingTypeToPlace: type }),
  loading: false,
  currentProjectId: null,
  activeSectors: [],
  setActiveSectors: (sectors) => set({ activeSectors: sectors }),

  // Camera controls state
  cameraState: {
    preset: 'free',
    isAnimating: false,
    camera: null,
    controls: null
  },

  cameraController: null,

  setCameraRefs: (camera, controls) => {
    set(state => ({
      cameraState: {
        ...state.cameraState,
        camera,
        controls
      }
    }));
  },

  registerCameraController: (controller) => set({ cameraController: controller }),

  setCameraTransitioning: (isAnimating) => {
    // Called every frame by the rig; skip the update when nothing changed so we
    // don't re-render every subscriber 60 times a second.
    if (get().cameraState.isAnimating === isAnimating) return;
    set(state => ({
      cameraState: { ...state.cameraState, isAnimating }
    }));
  },

  flyToLocation: (location) => {
    get().flyToCameraLocation(location.position);
  },

  animateToPreset: (newPreset: CameraPreset) => {
    const { cameraController } = get();

    // Record the intent even if the rig has not mounted yet, so UI that keys off
    // the active preset (AddMenu's aerial-view gate, the camera toolbar
    // highlight) stays correct.
    set(state => ({
      cameraState: { ...state.cameraState, preset: newPreset }
    }));

    cameraController?.animateToPreset(newPreset);
  },

  flyToCameraLocation: (position: [number, number, number]) => {
    const { cameraController } = get();
    cameraController?.flyToLocation(position);
  },

  fetchProjectData: async (
    projectId: string,
    modelType?: 'planning' | 'corporate',
    sectors?: string[]
  ) => {
    set({ loading: true, currentProjectId: projectId });
    try {
      // Materialise any active sector's template buildings into storage, so
      // everything on screen has a real, stable id.
      const { locations, roads } = modelType && sectors
        ? await localRepo.ensureSectorLocations(projectId, modelType, sectors)
        : await localRepo.getCityData(projectId);
      set({ locations, roads });
    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      set({ loading: false });
    }
  },

  addBuilding: async (position: [number, number, number], name: string) => {
    const { buildingTypeToPlace, locations, currentProjectId, activeSectors } = get();
    if (!buildingTypeToPlace) return;

    // The viewer only renders locations whose zone is in the active sector set,
    // so a zone-less building would be placed and then immediately filtered out
    // of the scene. Adopt the first active sector by default.
    const zone = (activeSectors[0] as ZoneType | undefined) ?? undefined;

    const draft: Omit<Location, 'id'> = {
      name,
      type: buildingTypeToPlace,
      position,
      description: `New ${buildingTypeToPlace.toLowerCase()} in the city.`,
      color: BUILDING_TYPE_COLORS[buildingTypeToPlace] ?? '#60a5fa',
      zone
    };

    // Clear placement mode straight away so a double-click can't place twice
    // while the write is in flight.
    set({ isPlacingBuilding: false, buildingTypeToPlace: null });

    let created: Location = { ...draft, id: `local-${Date.now()}` };

    if (currentProjectId) {
      try {
        created = await localRepo.addLocation(currentProjectId, draft);
      } catch (error) {
        console.error('Failed to persist building, keeping it locally:', error);
      }
    }

    set({ locations: [...locations, created] });
  },

  removeLocation: async (locationId: string) => {
    const { locations, roads, currentProjectId, selectedLocation } = get();

    // Roads referencing a removed building would dangle and render as nothing,
    // so drop them alongside it.
    const nextLocations = locations.filter(l => l.id !== locationId);
    const nextRoads = roads.filter(r => r.from !== locationId && r.to !== locationId);

    set({
      locations: nextLocations,
      roads: nextRoads,
      selectedLocation: selectedLocation?.id === locationId ? null : selectedLocation,
      routeStartId: get().routeStartId === locationId ? null : get().routeStartId
    });

    if (!currentProjectId) return;

    try {
      await localRepo.deleteLocation(currentProjectId, locationId);
    } catch (error) {
      console.error('Failed to delete building from storage:', error);
    }
  },

  updateLocationDesign: (locationId, design) => {
    const { locations, selectedLocation, currentProjectId } = get();

    const target = locations.find(l => l.id === locationId);
    if (!target) return;

    const nextDesign = { ...target.design, ...design };
    const updated = { ...target, design: nextDesign };

    // Update state synchronously so the scene and the analytics respond as the
    // user drags a slider.
    set({
      locations: locations.map(l => (l.id === locationId ? updated : l)),
      selectedLocation: selectedLocation?.id === locationId ? updated : selectedLocation
    });

    if (!currentProjectId) return;

    // Persist in the background; a dropped write costs a design tweak, not the
    // interaction, so this deliberately doesn't block or revert the UI.
    void (async () => {
      try {
        await localRepo.updateLocation(currentProjectId, locationId, { design: nextDesign });
      } catch (error) {
        console.error('Failed to persist building design:', error);
      }
    })();
  },

  pickRouteEndpoint: async (locationId: string) => {
    const { routeStartId, locations, roads, roadTypeToPlace, currentProjectId } = get();

    // First click just marks the start.
    if (!routeStartId) {
      set({ routeStartId: locationId });
      return;
    }

    // Clicking the same building again cancels the pick rather than making a
    // zero-length road.
    if (routeStartId === locationId) {
      set({ routeStartId: null });
      return;
    }

    const from = locations.find(l => l.id === routeStartId);
    const to = locations.find(l => l.id === locationId);
    if (!from || !to) {
      set({ routeStartId: null });
      return;
    }

    // Don't duplicate an existing connection in either direction.
    const exists = roads.some(
      r =>
        (r.from === from.id && r.to === to.id) ||
        (r.from === to.id && r.to === from.id)
    );
    if (exists) {
      set({ routeStartId: null });
      return;
    }

    const dx = to.position[0] - from.position[0];
    const dz = to.position[2] - from.position[2];
    const distance = Math.round(Math.sqrt(dx * dx + dz * dz));

    const draft: Omit<Road, 'id'> = {
      from: from.id,
      to: to.id,
      distance,
      type: roadTypeToPlace
    };

    // Chain from this endpoint so a run of roads can be drawn without
    // re-selecting the start each time.
    set({ routeStartId: locationId });

    let created: Road = { ...draft, id: `local-road-${Date.now()}` };

    if (currentProjectId) {
      try {
        created = await localRepo.addRoad(currentProjectId, draft);
      } catch (error) {
        console.error('Failed to persist road, keeping it locally:', error);
      }
    }

    set({ roads: [...get().roads, created] });
  }
}));