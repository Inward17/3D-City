import { useState } from 'react';
import { useCityStore } from '../store/cityStore';
import { Building, Trees, Landmark, UtensilsCrossed, Store, School, Guitar as Hospital, Library, Coffee, Hotel, X, Trash2, Route } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Location } from '../types/city';
import { buildingCapacity, occupancyFactor } from '../utils/cityMetrics';
import { BuildingDesigner } from './BuildingDesigner';

const typeIcons = {
  Building,
  Park: Trees,
  Museum: Landmark,
  Restaurant: UtensilsCrossed,
  Shop: Store,
  School,
  Hospital,
  Library,
  Cafe: Coffee,
  Hotel,
};

interface OccupancyPoint {
  hour: string;
  /** Estimated people present in this building at that hour. */
  people: number;
  /** Percentage of the building's capacity. */
  occupancy: number;
  isCurrent: boolean;
}

/**
 * Occupancy across the day for one building.
 *
 * Uses the shared per-type curve and capacity model, so this chart agrees with
 * the figures in Analytics. The previous version added Math.random() jitter —
 * which reshuffled the whole chart on every render — and switched on a type
 * called 'Office' that does not exist in Location['type'] (offices are
 * 'Building'), so every office silently fell through to a flat default.
 */
function generateOccupancyData(location: Location, currentTime: number): OccupancyPoint[] {
  const capacity = buildingCapacity(location);

  return Array.from({ length: 24 }, (_, hour) => {
    const factor = occupancyFactor(location.type, hour);
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      people: Math.round(capacity * factor),
      occupancy: Math.round(factor * 100),
      isCurrent: Math.floor(currentTime) === hour
    };
  });
}

export function LocationInfo() {
  const { selectedLocation, setSelectedLocation, timeOfDay, roads, removeLocation } =
    useCityStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [tab, setTab] = useState<'info' | 'design'>('info');

  if (!selectedLocation) return null;

  const connectedRoads = roads.filter(
    r => r.from === selectedLocation.id || r.to === selectedLocation.id
  ).length;

  const Icon = typeIcons[selectedLocation.type] || Building;
  const occupancyData = generateOccupancyData(selectedLocation, timeOfDay);
  const current = occupancyData.find(d => d.isCurrent);
  const currentOccupancy = current?.occupancy ?? 0;
  const currentPeople = current?.people ?? 0;
  const capacity = buildingCapacity(selectedLocation);

  return (
    <div className="panel absolute bottom-4 left-4 z-10 w-[340px] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${selectedLocation.color || '#64748b'}22` }}
          >
            <Icon className="h-4 w-4" style={{ color: selectedLocation.color || '#64748b' }} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
              {selectedLocation.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedLocation.type}
              {selectedLocation.zone && ` · ${selectedLocation.zone}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSelectedLocation(null)}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="segment">
          {(['info', 'design'] as const).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`segment-item flex-1 justify-center capitalize ${
                tab === id ? 'segment-item-active' : ''
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {tab === 'design' ? (
        <div className="border-t border-slate-900/[0.07] dark:border-white/[0.08]">
          <BuildingDesigner location={selectedLocation} />
        </div>
      ) : (
      <>
      {selectedLocation.description && (
        <p className="px-4 pb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {selectedLocation.description}
        </p>
      )}

      <div className="border-t border-slate-900/[0.07] px-4 py-3 dark:border-white/[0.08]">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="panel-heading">Occupancy today</h3>
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tabular-nums text-sky-600 dark:text-sky-400">
              {currentPeople.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">
              / {capacity.toLocaleString()} ({currentOccupancy}%)
            </span>
          </span>
        </div>

        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={occupancyData} margin={{ top: 6, right: 4, bottom: 0, left: -28 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-slate-300 dark:text-slate-700" vertical={false} />
              <XAxis
                dataKey="hour"
                interval={5}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-slate-400"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-slate-400"
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), 'People']}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: 'rgb(15 23 42 / 0.92)',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#fff',
                  padding: '6px 10px'
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line
                type="monotone"
                dataKey="people"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#38bdf8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      </>
      )}

      <div className="flex items-center justify-between border-t border-slate-900/[0.07] px-4 py-2.5 dark:border-white/[0.08]">
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Route className="h-3.5 w-3.5" />
          {connectedRoads} {connectedRoads === 1 ? 'road' : 'roads'}
        </span>

        {confirmingDelete ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                void removeLocation(selectedLocation.id);
              }}
              className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-500"
            >
              {connectedRoads > 0 ? `Delete + ${connectedRoads} roads` : 'Confirm delete'}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}