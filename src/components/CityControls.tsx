import { useMemo } from 'react';
import { Cloud, Snowflake, Sun, Moon, Sunrise, Map, Car } from 'lucide-react';
import { useCityStore } from '../store/cityStore';
import { computeTrafficDemand } from '../utils/trafficDemand';

const weatherOptions = [
  { id: 'clear', label: 'Clear', icon: Sun },
  { id: 'rain', label: 'Rain', icon: Cloud },
  { id: 'snow', label: 'Snow', icon: Snowflake }
] as const;

/** Quick jumps so the user isn't forced to drag for a specific hour. */
const timePresets = [
  { label: 'Dawn', hour: 6.5, icon: Sunrise },
  { label: 'Noon', hour: 12, icon: Sun },
  { label: 'Dusk', hour: 18, icon: Sunrise },
  { label: 'Night', hour: 22, icon: Moon }
];

export function CityControls() {
  const {
    timeOfDay, setTimeOfDay,
    weather, setWeather,
    showGeoMap, setShowGeoMap,
    trafficRate, setTrafficRate,
    locations, roads
  } = useCityStore();

  // Shown live so the effect of the slider — and of adding buildings — is legible.
  const demand = useMemo(
    () => computeTrafficDemand(locations, roads, timeOfDay, trafficRate),
    [locations, roads, timeOfDay, trafficRate]
  );

  const timeFormatted = useMemo(() => {
    const hours = Math.floor(timeOfDay);
    const minutes = Math.floor((timeOfDay % 1) * 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }, [timeOfDay]);

  const isDaytime = timeOfDay >= 6 && timeOfDay <= 18;

  return (
    <div className="panel absolute right-4 top-4 z-10 w-[260px] p-4">
      {/* Time of day */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="panel-heading">Time of day</h3>
          <span className="flex items-center gap-1.5 font-mono text-sm font-medium text-slate-800 dark:text-slate-100">
            {isDaytime
              ? <Sun className="h-3.5 w-3.5 text-amber-500" />
              : <Moon className="h-3.5 w-3.5 text-indigo-400" />}
            {timeFormatted}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="24"
          step="0.25"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
          className="slider w-full cursor-pointer"
          aria-label="Time of day"
        />

        <div className="mt-2 grid grid-cols-4 gap-1">
          {timePresets.map(({ label, hour, icon: Icon }) => {
            const active = Math.abs(timeOfDay - hour) < 0.3;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setTimeOfDay(hour)}
                className={`flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[10px]
                            font-medium transition-colors ${
                  active
                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                    : 'text-slate-500 hover:bg-slate-900/5 dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="my-3.5 h-px bg-slate-900/[0.07] dark:bg-white/[0.08]" />

      {/* Weather */}
      <div>
        <h3 className="panel-heading mb-2">Weather</h3>
        <div className="segment">
          {weatherOptions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setWeather(id)}
              className={`segment-item flex-1 justify-center ${
                weather === id ? 'segment-item-active' : ''
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="my-3.5 h-px bg-slate-900/[0.07] dark:bg-white/[0.08]" />

      {/* Traffic rate */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="panel-heading flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5" />
            Traffic
          </h3>
          <span className="font-mono text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100">
            {demand.vehicles}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={trafficRate}
          onChange={(e) => setTrafficRate(parseFloat(e.target.value))}
          className="slider w-full cursor-pointer"
          aria-label="Traffic rate"
        />

        <div className="mt-1.5 flex items-baseline justify-between text-[10px] text-slate-500 dark:text-slate-400">
          <span>
            {trafficRate === 0
              ? 'No traffic'
              : `${trafficRate.toFixed(1)}× modelled demand`}
          </span>
          <span>
            {demand.capped
              ? 'capped'
              : `${demand.occupants.toLocaleString()} people out`}
          </span>
        </div>
      </div>

      <div className="my-3.5 h-px bg-slate-900/[0.07] dark:bg-white/[0.08]" />

      {/* Geo map toggle */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Map className="h-4 w-4 text-slate-400" />
          Geo map
        </span>
        <button
          type="button"
          onClick={() => setShowGeoMap(!showGeoMap)}
          role="switch"
          aria-checked={showGeoMap}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
                      transition-colors duration-200 focus:outline-none
                      focus-visible:ring-2 focus-visible:ring-sky-400 ${
            showGeoMap ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span className="sr-only">Toggle background map</span>
          <span
            className={`pointer-events-none mt-0.5 inline-block h-4 w-4 transform rounded-full
                        bg-white shadow transition duration-200 ${
              showGeoMap ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
