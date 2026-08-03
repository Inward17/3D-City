import { useMemo } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { useCityStore } from '../store/cityStore';
import { maxDimensionsFor, MIN_BUILDING_GAP } from '../utils/buildingCollision';
import { maxBuildableSize } from '../utils/roadNetwork';
import { Location, RoofStyle } from '../types/city';
import {
  DESIGN_LIMITS,
  STOREY_HEIGHT,
  getEffectiveDimensions
} from '../utils/buildingDimensions';
import { buildingCapacity, derivedCapacity } from '../utils/cityMetrics';
import { PAVEMENT_WIDTH } from '../utils/scale';

const PALETTE = [
  '#60a5fa', '#38bdf8', '#34d399', '#a3e635',
  '#fbbf24', '#fb923c', '#f87171', '#f472b6',
  '#a78bfa', '#94a3b8', '#cbd5e1', '#64748b'
];

const ROOFS: { id: RoofStyle; label: string }[] = [
  { id: 'flat', label: 'Flat' },
  { id: 'pitched', label: 'Pitched' },
  { id: 'stepped', label: 'Stepped' }
];

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider w-full cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}

export function BuildingDesigner({ location }: { location: Location }) {
  const updateLocationDesign = useCityStore(s => s.updateLocationDesign);
  const locations = useCityStore(s => s.locations);
  const roads = useCityStore(s => s.roads);

  const crossingStyles = useCityStore(s => s.crossingStyles);
  const dims = getEffectiveDimensions(location);

  /*
    What everything *else* looks like. Resizing this building changes the
    `locations` array identity every tick, but only the other buildings can
    move this building's limits, so the caps below key off this instead.
  */
  const othersKey = useMemo(
    () => locations
      .filter(l => l.id !== location.id)
      .map(l => `${l.id}@${l.position[0]},${l.position[2]}:${l.design?.width ?? ''}x${l.design?.depth ?? ''}`)
      .join('|'),
    [locations, location.id]
  );

  /*
    Solving the buildable size re-routes every road a handful of times, so it is
    kept off the drag path. Each axis' cap depends on the *other* axis and never
    on itself, so dragging Width re-solves only Depth's cap — the slider you are
    holding never moves underneath you.
  */
  /* eslint-disable react-hooks/exhaustive-deps -- deps are deliberately narrower
     than the closure: see the two comments above. */
  const maxWidth = useMemo(
    () => maxBuildableSize(location, locations, roads, crossingStyles).width,
    [location.id, dims.depth, othersKey, roads, crossingStyles]
  );
  const maxDepth = useMemo(
    () => maxBuildableSize(location, locations, roads, crossingStyles).depth,
    [location.id, dims.width, othersKey, roads, crossingStyles]
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const fit = { width: maxWidth, depth: maxDepth };

  // Parks have no facade to design; the editor is only offered for buildings.
  if (location.type === 'Park') {
    return (
      <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        Parks have no facade to edit.
      </p>
    );
  }

  const design = location.design ?? {};
  const capacity = buildingCapacity(location);
  const derived = derivedCapacity(location);
  const isOverridden = design.population != null;

  const constrained =
    fit.width < DESIGN_LIMITS.width.max || fit.depth < DESIGN_LIMITS.depth.max;

  /*
    Name the actual blocker. Neighbouring buildings don't move, so the one-step
    answer is already exact for them; anything tighter than that is the roads.
  */
  const neighbourFit = maxDimensionsFor(location, locations);
  const blockedByRoad =
    fit.width < neighbourFit.width || fit.depth < neighbourFit.depth;
  const activeColor = design.color || location.color || '#7c8ba1';
  const roof = design.roof ?? 'flat';

  return (
    <div className="space-y-3.5 px-4 py-3">
      <Slider
        label="Floors"
        value={dims.floors}
        min={DESIGN_LIMITS.floors.min}
        max={DESIGN_LIMITS.floors.max}
        suffix={` (${Math.round(dims.floors * STOREY_HEIGHT)} m)`}
        onChange={(floors) => updateLocationDesign(location.id, { floors })}
      />

      <Slider
        label="Width"
        value={Math.round(dims.width)}
        min={DESIGN_LIMITS.width.min}
        max={fit.width}
        suffix=" m"
        onChange={(width) => updateLocationDesign(location.id, { width })}
      />

      <Slider
        label="Depth"
        value={Math.round(dims.depth)}
        min={DESIGN_LIMITS.depth.min}
        max={fit.depth}
        suffix=" m"
        onChange={(depth) => updateLocationDesign(location.id, { depth })}
      />

      {/* Say why the sliders stop short, rather than just feeling stuck. */}
      {constrained && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {blockedByRoad
              ? `Limited by a road or roundabout — a ${PAVEMENT_WIDTH} m pavement is kept clear of the kerb.`
              : `Limited by a neighbouring building — a ${MIN_BUILDING_GAP} m gap is kept between footprints.`}
            {' '}Max {fit.width} × {fit.depth} m here.
          </span>
        </p>
      )}

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Roof
        </span>
        <div className="segment">
          {ROOFS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => updateLocationDesign(location.id, { roof: id })}
              className={`segment-item flex-1 justify-center ${
                roof === id ? 'segment-item-active' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Facade
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => updateLocationDesign(location.id, { color })}
              aria-label={`Set facade ${color}`}
              className={`h-6 w-6 rounded-md ring-offset-1 transition-transform hover:scale-110
                          dark:ring-offset-slate-900 ${
                activeColor.toLowerCase() === color
                  ? 'ring-2 ring-sky-500'
                  : 'ring-1 ring-slate-900/10 dark:ring-white/10'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Population: derived from floor area by default, overridable. */}
      <div className="rounded-lg bg-slate-900/[0.04] p-3 dark:bg-white/[0.05]">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Population
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {isOverridden ? 'set manually' : `estimated from ${dims.floors} floors`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100000}
            value={capacity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              updateLocationDesign(location.id, {
                population: Number.isFinite(v) ? Math.max(0, v) : undefined
              });
            }}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm
                       tabular-nums text-slate-900 focus:border-sky-400 focus:outline-none
                       focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700
                       dark:bg-slate-800 dark:text-white"
            aria-label="Population"
          />
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">people</span>
        </div>

        {isOverridden && (
          <button
            type="button"
            onClick={() => updateLocationDesign(location.id, { population: undefined })}
            className="mt-1.5 text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Use estimate ({derived.toLocaleString()})
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() =>
          updateLocationDesign(location.id, {
            width: undefined,
            depth: undefined,
            floors: undefined,
            color: undefined,
            roof: undefined,
            population: undefined
          })
        }
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200"
      >
        <RotateCcw className="h-3 w-3" />
        Reset to type default
      </button>
    </div>
  );
}
