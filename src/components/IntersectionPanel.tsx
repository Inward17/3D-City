import { useMemo } from 'react';
import { GitFork, Info } from 'lucide-react';
import { useCityStore } from '../store/cityStore';
import { buildRoadNetwork } from '../utils/roadNetwork';
import { CROSSING_STYLES, CrossingStyle } from '../utils/roadCrossings';

/**
 * Lists every place two roads cross and lets each one be resolved as an
 * at-grade crossing, a roundabout, a bridge or an underpass.
 *
 * Crossings are the only real intersections in this model — roads meet
 * buildings at their ends, and treating those as junctions is what previously
 * drew roundabouts through the middle of City Hall.
 */
export function IntersectionPanel({ onClose }: { onClose: () => void }) {
  const {
    locations, roads, crossingStyles, setCrossingStyle,
    selectedCrossing, setSelectedCrossing, flyToCameraLocation
  } = useCityStore();

  const crossings = useMemo(
    () => buildRoadNetwork(locations, roads, crossingStyles).crossings,
    [locations, roads, crossingStyles]
  );

  const nameOf = (roadId: string) => {
    const road = roads.find(r => r.id === roadId);
    if (!road) return 'road';
    const from = locations.find(l => l.id === road.from)?.name ?? '?';
    const to = locations.find(l => l.id === road.to)?.name ?? '?';
    return `${from} → ${to}`;
  };

  return (
    <div className="panel absolute right-4 top-4 z-20 w-[340px] overflow-hidden">
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h3 className="panel-heading flex items-center gap-1.5">
          <GitFork className="h-3.5 w-3.5" />
          Intersections
        </h3>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      {crossings.length === 0 ? (
        <div className="px-4 pb-4">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              No roads cross yet. The starter layouts connect each building
              directly to its neighbours, so no two carriageways meet mid-span.
              Draw a route with <em>Add to city → Add route</em> that cuts across
              an existing road and the intersection will appear here.
            </span>
          </p>
        </div>
      ) : (
        <div className="custom-scrollbar max-h-[60vh] overflow-y-auto px-3 pb-3">
          {crossings.map(crossing => {
            const isSelected = selectedCrossing === crossing.key;
            return (
              <div
                key={crossing.key}
                className={`mb-2 rounded-lg border p-2.5 transition-colors ${
                  isSelected
                    ? 'border-sky-400/60 bg-sky-500/10'
                    : 'border-slate-900/[0.07] dark:border-white/[0.08]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCrossing(isSelected ? null : crossing.key);
                    flyToCameraLocation([crossing.point.x, 0, crossing.point.y]);
                  }}
                  className="mb-2 block w-full text-left"
                >
                  <span className="block text-xs font-medium text-slate-800 dark:text-slate-100">
                    {nameOf(crossing.primaryId)}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    crosses {nameOf(crossing.secondaryId)}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-1">
                  {CROSSING_STYLES.map(({ id, label, description }) => {
                    const blocked = id === 'roundabout' && !crossing.roundaboutFits;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={blocked}
                        title={blocked ? 'Not enough room — a building is too close' : description}
                        onClick={() => setCrossingStyle(crossing.key, id as CrossingStyle)}
                        className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                          blocked
                            ? 'cursor-not-allowed bg-slate-900/[0.03] text-slate-400 dark:bg-white/[0.03] dark:text-slate-600'
                            : crossing.style === id
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-900/[0.05] text-slate-600 hover:bg-slate-900/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {(crossing.style === 'bridge' || crossing.style === 'underpass') && (
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {nameOf(crossing.overId!)} passes over.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
