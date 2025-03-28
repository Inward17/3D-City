import { useMemo } from 'react';
import { Clock, Cloud, CloudSun, Sun, Moon } from 'lucide-react';
import { useCityStore } from '../store/cityStore';

export function CityControls() {
  const { timeOfDay, setTimeOfDay, weather, setWeather } = useCityStore();

  const timeFormatted = useMemo(() => {
    const hours = Math.floor(timeOfDay);
    const minutes = Math.floor((timeOfDay % 1) * 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }, [timeOfDay]);

  const isDaytime = timeOfDay >= 6 && timeOfDay <= 18;

  return (
    <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg">
      <div className="space-y-4">
        {/* Time Control */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Time of Day
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="24"
              step="0.1"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-mono">{timeFormatted}</span>
            {isDaytime ? (
              <Sun className="w-4 h-4 text-yellow-500" />
            ) : (
              <Moon className="w-4 h-4 text-blue-500" />
            )}
          </div>
        </div>

        {/* Weather Control */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CloudSun className="w-4 h-4" />
            Weather
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setWeather('clear')}
              className={`px-3 py-1 rounded-md text-sm flex items-center gap-1 ${
                weather === 'clear'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Sun className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={() => setWeather('rain')}
              className={`px-3 py-1 rounded-md text-sm flex items-center gap-1 ${
                weather === 'rain'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Cloud className="w-4 h-4" />
              Rain
            </button>
            <button
              onClick={() => setWeather('snow')}
              className={`px-3 py-1 rounded-md text-sm flex items-center gap-1 ${
                weather === 'snow'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Cloud className="w-4 h-4" />
              Snow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}