import { useState } from 'react';
import {
  Building, Trees, Landmark, UtensilsCrossed, Store, School,
  Guitar as Hospital, Library, Coffee, Hotel, Route, Plus,
  ChevronDown, MousePointerClick, X
} from 'lucide-react';
import { useCityStore } from '../store/cityStore';

const buildingTypes = [
  { type: 'Building', icon: Building, label: 'Office' },
  { type: 'Park', icon: Trees, label: 'Park' },
  { type: 'Museum', icon: Landmark, label: 'Museum' },
  { type: 'Restaurant', icon: UtensilsCrossed, label: 'Restaurant' },
  { type: 'Shop', icon: Store, label: 'Shop' },
  { type: 'School', icon: School, label: 'School' },
  { type: 'Hospital', icon: Hospital, label: 'Hospital' },
  { type: 'Library', icon: Library, label: 'Library' },
  { type: 'Cafe', icon: Coffee, label: 'Cafe' },
  { type: 'Hotel', icon: Hotel, label: 'Hotel' },
] as const;

const roadTypes = [
  { id: 'main', label: 'Main' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'residential', label: 'Local' }
] as const;

export function AddMenu() {
  const {
    isPlacingBuilding,
    setIsPlacingBuilding,
    buildingTypeToPlace,
    setBuildingTypeToPlace,
    isPlacingRoute,
    setIsPlacingRoute,
    roadTypeToPlace,
    setRoadTypeToPlace,
    routeStartId,
    setRouteStartId
  } = useCityStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showBuildingPanel, setShowBuildingPanel] = useState(false);

  const cancelPlacement = () => {
    setIsPlacingBuilding(false);
    setBuildingTypeToPlace(null);
    setIsPlacingRoute(false);
  };

  // Placement raycasts against the ground plane, which works from any camera
  // angle — the old aerial-view requirement just blocked the feature.
  const handleAddBuildingClick = () => {
    setIsDropdownOpen(false);
    cancelPlacement();
    setShowBuildingPanel(true);
  };

  const handleAddRouteClick = () => {
    setIsDropdownOpen(false);
    cancelPlacement();
    setShowBuildingPanel(false);
    setIsPlacingRoute(true);
  };

  const handleBuildingSelect = (type: typeof buildingTypes[number]['type']) => {
    setBuildingTypeToPlace(type);
    setIsPlacingBuilding(true);
    setShowBuildingPanel(false);
  };

  const isPlacingAnything = isPlacingBuilding || isPlacingRoute;

  return (
    <div className="absolute top-4 left-4 z-10 flex w-[290px] flex-col items-start gap-2">
      <div className="relative w-full">
        {isPlacingAnything ? (
          <button
            onClick={cancelPlacement}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5
                       text-sm font-medium text-white shadow-lg transition-colors hover:bg-rose-500"
          >
            <X className="h-4 w-4" />
            Cancel placement
          </button>
        ) : (
          <button
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
              setShowBuildingPanel(false);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-sky-600 px-4 py-2.5
                       text-sm font-medium text-white shadow-lg transition-colors hover:bg-sky-500"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add to city
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}

        {isDropdownOpen && !isPlacingAnything && (
          <div className="panel absolute left-0 top-full mt-2 w-full overflow-hidden p-1">
            <button
              onClick={handleAddBuildingClick}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left
                         transition-colors hover:bg-slate-900/5 dark:hover:bg-white/5"
            >
              <span className="rounded-md bg-sky-500/15 p-2 text-sky-600 dark:text-sky-400">
                <Building className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  Add building
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Place structures on the map
                </span>
              </span>
            </button>
            <button
              onClick={handleAddRouteClick}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left
                         transition-colors hover:bg-slate-900/5 dark:hover:bg-white/5"
            >
              <span className="rounded-md bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
                <Route className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  Add route
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Draw paths and roads
                </span>
              </span>
            </button>
          </div>
        )}
      </div>

      {showBuildingPanel && (
        <div className="panel w-full p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="panel-heading">Building type</h3>
            <button
              onClick={() => setShowBuildingPanel(false)}
              className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="custom-scrollbar grid max-h-[320px] grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {buildingTypes.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => handleBuildingSelect(type)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-transparent
                           bg-slate-900/[0.03] p-2.5 transition-all
                           hover:border-sky-400/50 hover:bg-sky-500/10
                           dark:bg-white/[0.04] dark:hover:bg-sky-500/10"
              >
                <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                <span className="text-center text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-300">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isPlacingBuilding && (
        <div className="panel w-full border-l-2 border-l-sky-500 p-3">
          <div className="mb-1 flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-sky-500" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Placing {buildingTypeToPlace}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Click the ground to place. Positions snap to a 10m grid.
            Right-drag to pan, scroll to zoom.
          </p>
        </div>
      )}

      {isPlacingRoute && (
        <div className="panel w-full border-l-2 border-l-emerald-500 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Route className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Drawing route
            </span>
          </div>

          <div className="segment mb-2.5">
            {roadTypes.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRoadTypeToPlace(id)}
                className={`segment-item flex-1 justify-center ${
                  roadTypeToPlace === id ? 'segment-item-active' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {routeStartId
              ? 'Now click the building to connect to. Roads chain, so keep clicking to continue the run.'
              : 'Click the first building to start from.'}
          </p>

          {routeStartId && (
            <button
              type="button"
              onClick={() => setRouteStartId(null)}
              className="mt-2 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Clear start point
            </button>
          )}
        </div>
      )}
    </div>
  );
}
