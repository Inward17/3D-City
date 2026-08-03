import { create } from 'zustand';
import { Location, Road, ZoneType, BuildingDesign } from '../types/city';
import { localRepo } from '../lib/localRepo';
import { clampDesignToNeighbours, isPlacementClear } from '../utils/buildingCollision';
import { getEffectiveDimensions } from '../utils/buildingDimensions';
import { dayOfYear as currentDayOfYear } from '../utils/solar';
import type { CrossingStyle } from '../utils/roadCrossings';
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
  /** Colour the roads by how much of their capacity is used. */
  showCongestion: boolean;
  setShowCongestion: (show: boolean) => void;
  /**
   * Site latitude, degrees north. Drives the sun's height and path, so it
   * decides how long a shadow is and how long the day lasts.
   */
  latitude: number;
  setLatitude: (latitude: number) => void;
  /** Day of the year being studied, 1-366. */
  dayOfYear: number;
  setDayOfYear: (day: number) => void;
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
  /** How each road crossing is resolved, keyed by crossingKey(). */
  crossingStyles: Record<string, CrossingStyle>;
  setCrossingStyle: (key: string, style: CrossingStyle) => void;
  /** Crossing currently selected in the viewer, if any. */
  selectedCrossing: string | null;
  setSelectedCrossing: (key: string | null) => void;
  flyToLocation: (location: Location) => void;
  // Camera controls state
  cameraState: CameraState;
  cameraController: CameraController | null;
  setCameraRefs: (camera: THREE.Camera, controls: OrbitControls) => void;
  registerCameraController: (controller: CameraController | null) => void;
  setCameraTransitioning: (isAnimating: boolean) => void;
  animateToPreset: (preset: CameraPreset) => void;
  flyToCameraLocation: (
    position: [number, number, number],
    offset?: [number, number, number]
  ) => void;
}

export const useCityStore = create<CityStore>((set, get) => ({
  selectedLocation: null,
  setSelectedLocation: (location) => {
    set({ selectedLocation: location, selectedCrossing: location ? null : get().selectedCrossing });
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
  showCongestion: false,
  setShowCongestion: (showCongestion) => set({ showCongestion }),
  // Defaults match the project template's centre (Pune) until a project with
  // real coordinates is opened.
  latitude: 18.52,
  setLatitude: (latitude) => set({ latitude: Math.max(-89, Math.min(89, latitude)) }),
  dayOfYear: currentDayOfYear(new Date()),
  setDayOfYear: (day) => set({ dayOfYear: Math.max(1, Math.min(366, Math.round(day))) }),
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
  crossingStyles: {},
  selectedCrossing: null,
  // Buildings and intersections share the same corner of the screen, so only
  // one can be selected at a time.
  setSelectedCrossing: (key) =>
    set({ selectedCrossing: key, selectedLocation: key ? null : get().selectedLocation }),

  setCrossingStyle: (key, style) => {
    const { crossingStyles, currentProjectId } = get();
    const next = { ...crossingStyles, [key]: style };
    set({ crossingStyles: next });

    if (!currentProjectId) return;
    void localRepo
      .setCrossingStyles(currentProjectId, next)
      .catch(error => console.error('Failed to persist crossing style:', error));
  },

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
    /*
      Stand back far enough to see the whole building, and look at its middle
      rather than the pavement it stands on. The old fixed [10, 10, 10] offset
      put the camera inside anything bigger than a bungalow — selecting a tower
      dropped you in its lobby.
    */
    const { width, depth, height } = getEffectiveDimensions(location);
    const reach = Math.max(Math.hypot(width, depth), height);
    const distance = reach * 1.4 + 15;
    const [x, , z] = location.position;

    get().flyToCameraLocation(
      [x, height * 0.45, z],
      [distance * 0.62, distance * 0.55, distance * 0.62]
    );
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

  flyToCameraLocation: (
    position: [number, number, number],
    offset?: [number, number, number]
  ) => {
    const { cameraController } = get();
    cameraController?.flyToLocation(position, offset);
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
      const crossingStyles = await localRepo.getCrossingStyles(projectId);
      set({ locations, roads, crossingStyles, selectedCrossing: null });

      /*
        Adopt the site's real latitude, so the sun follows the path it takes
        there. The project has stored coordinates since it was created; nothing
        had ever read them.
      */
      const project = (await localRepo.listProjects()).find(p => p.id === projectId);
      if (project?.center_lat != null) get().setLatitude(project.center_lat);
    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      set({ loading: false });
    }
  },

  addBuilding: async (position: [number, number, number], name: string) => {
    const { buildingTypeToPlace, locations, currentProjectId, activeSectors } = get();
    if (!buildingTypeToPlace) return;

    // Refuse to stack a building on an existing footprint. The placement ghost
    // already shows this as invalid, but a click can still arrive (a fast
    // double-click, or a caller that skipped the preview).
    if (!isPlacementClear(position, buildingTypeToPlace, locations)) return;

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

    // Backstop against overlap. The editor already caps its sliders, but the
    // store is the source of truth and must not be drivable into a state where
    // two buildings occupy the same ground.
    const fitted = clampDesignToNeighbours(target, locations, {
      width: design.width,
      depth: design.depth
    });

    const nextDesign = {
      ...target.design,
      ...design,
      ...(design.width != null ? { width: fitted.width } : {}),
      ...(design.depth != null ? { depth: fitted.depth } : {})
    };
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