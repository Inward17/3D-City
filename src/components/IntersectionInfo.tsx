import { useMemo } from 'react';
import { GitFork, X, ArrowUpFromLine, AlertTriangle } from 'lucide-react';
import { useCityStore } from '../store/cityStore';
import { buildRoadNetwork } from '../utils/roadNetwork';
import {
  CROSSING_STYLES, CrossingStyle, ROUNDABOUT_BUILDING_GAP
} from '../utils/roadCrossings';
import { compareCrossingStyles } from '../utils/assignment';
import { useAssignment } from '../hooks/useAssignment';

/**
 * Details for the intersection currently selected in the 3D view.
 *
 * Selecting a crossing used to set state that nothing rendered — the marker
 * ring changed colour and that was all, so clicking an intersection appeared to
 * do nothing unless the Intersections list happened to be open. This is the
 * counterpart to LocationInfo: pick something in the scene, get its panel.
 */
export function IntersectionInfo() {
  const {
    locations, roads, crossingStyles,
    selectedCrossing, setSelectedCrossing, setCrossingStyle
  } = useCityStore();

  const crossing = useMemo(() => {
    if (!selectedCrossing) return null;
    const { crossings } = buildRoadNetwork(locations, roads, crossingStyles);
    return crossings.find(c => c.key === selectedCrossing) ?? null;
  }, [selectedCrossing, locations, roads, crossingStyles]);

  /*
    What each style would cost here, at the traffic this crossing actually
    carries. Until the assignment existed these four options produced identical
    traffic, so the choice was pure decoration; now it is a number the user can
    compare before committing.
  */
  const assignment = useAssignment(locations, roads);

  const options = useMemo(() => {
    if (!crossing) return [];
    const road = roads.find(r => r.id === crossing.primaryId);
    return compareCrossingStyles(crossing, assignment, road?.type ?? 'secondary');
  }, [crossing, assignment, roads]);

  const busiest = useMemo(() => {
    if (!crossing) return null;
    return assignment.links
      .filter(l => l.roadId === crossing.primaryId || l.roadId === crossing.secondaryId)
      .reduce<(typeof assignment.links)[number] | null>(
        (worst, l) => (!worst || l.volume > worst.volume ? l : worst),
        null
      );
  }, [crossing, assignment]);

  if (!crossing) return null;

  const available = options.filter(
    o => !(o.style === 'roundabout' && !crossing.roundaboutFits)
  );
  const bestDelay = available.length > 0
    ? Math.min(...available.map(o => o.delay))
    : 0;

  const nameOf = (roadId: string) => {
    const road = roads.find(r => r.id === roadId);
    if (!road) return 'road';
    const from = locations.find(l => l.id === road.from)?.name ?? '?';
    const to = locations.find(l => l.id === road.to)?.name ?? '?';
    return `${from} → ${to}`;
  };

  return (
    <div className="panel absolute bottom-4 left-4 z-10 w-[340px] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
            <GitFork className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
              Intersection
            </h2>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {nameOf(crossing.primaryId)}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSelectedCrossing(null)}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <p className="px-4 pb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        crosses <span className="font-medium">{nameOf(crossing.secondaryId)}</span>
      </p>

      <div className="border-t border-slate-900/[0.07] px-4 py-3 dark:border-white/[0.08]">
        <h3 className="panel-heading mb-2">Resolve as</h3>

        <div className="grid grid-cols-2 gap-1.5">
          {CROSSING_STYLES.map(({ id, label, description }) => {
            // A roundabout needs physical room; without it the option is
            // disabled rather than silently falling back to signals.
            const blocked = id === 'roundabout' && !crossing.roundaboutFits;
            const option = options.find(o => o.style === id);
            const best = option && option.delay === bestDelay;

            return (
              <button
                key={id}
                type="button"
                disabled={blocked}
                title={blocked ? 'Not enough room here — a building is too close' : description}
                onClick={() => setCrossingStyle(crossing.key, id as CrossingStyle)}
                className={`rounded-md px-2.5 py-2 text-left text-[11px] font-medium transition-colors ${
                  blocked
                    ? 'cursor-not-allowed bg-slate-900/[0.03] text-slate-400 dark:bg-white/[0.03] dark:text-slate-600'
                    : crossing.style === id
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-900/[0.05] text-slate-600 hover:bg-slate-900/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                <span className="block">{label}</span>
                {option && !blocked && (
                  <span
                    className={`mt-0.5 block text-[10px] font-normal tabular-nums ${
                      crossing.style === id
                        ? 'text-sky-50'
                        : best
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {option.delay < 0.5 ? 'no delay' : `+${Math.round(option.delay)} s`}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Congestion is the reason to prefer one of these over another. */}
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-slate-500 dark:text-slate-400">Busiest approach</dt>
          <dd className="text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
            {Math.round(busiest?.volume ?? 0)} veh/h
          </dd>
          <dt className="text-slate-500 dark:text-slate-400">Used capacity</dt>
          <dd
            className={`text-right font-medium tabular-nums ${
              (busiest?.saturation ?? 0) > 0.9
                ? 'text-red-600 dark:text-red-400'
                : (busiest?.saturation ?? 0) > 0.7
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {Math.round((busiest?.saturation ?? 0) * 100)}%
          </dd>
        </dl>

        {!crossing.roundaboutFits && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              No room for a roundabout — a building sits within{' '}
              {Math.round(crossing.roundaboutOuter + ROUNDABOUT_BUILDING_GAP)} m of this crossing.
            </span>
          </p>
        )}

        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {CROSSING_STYLES.find(s => s.id === crossing.style)?.description}
        </p>

        {crossing.overId && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-slate-900/[0.04] px-2.5 py-2 text-[11px] leading-relaxed text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
            <ArrowUpFromLine className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              <span className="font-medium">{nameOf(crossing.overId)}</span> rises over
              {' '}<span className="font-medium">{nameOf(crossing.underId!)}</span>.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
