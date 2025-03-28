import { create } from 'zustand';
import { Location, Road } from '../types/city';
import { cityData } from '../data/cityData';
import { v4 as uuidv4 } from 'uuid';

interface CityStore {
  selectedLocation: Location | null;
  setSelectedLocation: (location: Location | null) => void;
  locations: Location[];
  roads: Road[];
  timeOfDay: number;
  setTimeOfDay: (time: number | ((prev: number) => number)) => void;
  weather: 'clear' | 'rain' | 'snow';
  setWeather: (weather: 'clear' | 'rain' | 'snow') => void;
  isPlacingBuilding: boolean;
  setIsPlacingBuilding: (isPlacing: boolean) => void;
  buildingTypeToPlace: Location['type'] | null;
  setBuildingTypeToPlace: (type: Location['type'] | null) => void;
  addBuilding: (position: [number, number, number], name: string) => void;
  generateRoads: (newLocationId: string) => void;
}

export const useCityStore = create<CityStore>((set, get) => ({
  selectedLocation: null,
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  locations: cityData.locations,
  roads: cityData.roads,
  timeOfDay: 12,
  setTimeOfDay: (time) => set((state) => ({
    timeOfDay: typeof time === 'function' ? time(state.timeOfDay) : time
  })),
  weather: 'clear',
  setWeather: (weather) => set({ weather }),
  isPlacingBuilding: false,
  setIsPlacingBuilding: (isPlacing) => set({ isPlacingBuilding: isPlacing }),
  buildingTypeToPlace: null,
  setBuildingTypeToPlace: (type) => set({ buildingTypeToPlace: type }),

  addBuilding: (position, name) => {
    const { buildingTypeToPlace, locations, generateRoads } = get();
    if (!buildingTypeToPlace) return;

    const newLocationId = uuidv4();
    const newLocation: Location = {
      id: newLocationId,
      name,
      type: buildingTypeToPlace,
      position,
      description: `New ${buildingTypeToPlace.toLowerCase()} in the city.`,
      color: getColorForType(buildingTypeToPlace),
    };

    set((state) => ({
      locations: [...state.locations, newLocation],
      isPlacingBuilding: false,
      buildingTypeToPlace: null,
    }));

    generateRoads(newLocationId);
  },

  generateRoads: (newLocationId: string) => {
    const { locations, roads } = get();
    const newLocation = locations.find(loc => loc.id === newLocationId);
    if (!newLocation) return;

    // Find nearest locations to connect to
    const nearestLocations = findNearestLocations(newLocation, locations, 3);
    const newRoads: Road[] = nearestLocations.map(nearest => ({
      id: uuidv4(),
      from: newLocationId,
      to: nearest.id,
      distance: calculateDistance(newLocation.position, nearest.position),
      type: determineRoadType(newLocation.type, nearest.type),
    }));

    set((state) => ({
      roads: [...state.roads, ...newRoads],
    }));
  },
}));

// Helper functions
function getColorForType(type: Location['type']): string {
  const colors = {
    Building: '#60a5fa',
    Park: '#4ade80',
    Museum: '#f472b6',
    Restaurant: '#fbbf24',
    Shop: '#a78bfa',
    School: '#fb923c',
    Hospital: '#ef4444',
    Library: '#84cc16',
    Cafe: '#f97316',
    Hotel: '#06b6d4',
  };
  return colors[type] || '#60a5fa';
}

function calculateDistance(pos1: [number, number, number], pos2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(pos2[0] - pos1[0], 2) +
    Math.pow(pos2[1] - pos1[1], 2) +
    Math.pow(pos2[2] - pos1[2], 2)
  );
}

function findNearestLocations(
  location: Location,
  allLocations: Location[],
  count: number
): Location[] {
  return allLocations
    .filter(loc => loc.id !== location.id)
    .map(loc => ({
      ...loc,
      distance: calculateDistance(location.position, loc.position),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

function determineRoadType(
  type1: Location['type'],
  type2: Location['type']
): Road['type'] {
  const majorTypes = ['Hospital', 'School', 'Shopping'];
  if (majorTypes.includes(type1) || majorTypes.includes(type2)) {
    return 'main';
  }
  const mediumTypes = ['Restaurant', 'Library', 'Hotel'];
  if (mediumTypes.includes(type1) || mediumTypes.includes(type2)) {
    return 'secondary';
  }
  return 'residential';
}