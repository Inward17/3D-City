import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Users, Building, Activity, MapPin, Route, AlertTriangle, Info } from 'lucide-react';
import { Location, Road } from '../types/city';
import { useCityStore } from '../store/cityStore';
import { computeCityMetrics } from '../utils/cityMetrics';

interface SectorAnalyticsProps {
  locations: Location[];
  roads: Road[];
  activeSectors: string[];
  modelType: 'planning' | 'corporate';
}

const chartTooltip = {
  backgroundColor: 'rgb(15 23 42 / 0.94)',
  border: 'none',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#fff',
  padding: '8px 10px'
} as const;

function MetricCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub
}: {
  icon: typeof Building;
  iconClass: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

export function SectorAnalytics({
  locations,
  roads,
  activeSectors,
  modelType
}: SectorAnalyticsProps) {
  // Metrics track the viewer's clock, so the figures match what's on screen.
  const timeOfDay = useCityStore(state => state.timeOfDay);

  const metrics = useMemo(
    () => computeCityMetrics(locations, roads, activeSectors, timeOfDay),
    [locations, roads, activeSectors, timeOfDay]
  );

  const peopleLabel = modelType === 'planning' ? 'Population' : 'Employees';
  const hourLabel = `${Math.floor(timeOfDay).toString().padStart(2, '0')}:00`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          icon={Building}
          iconClass="text-sky-500"
          label="Buildings"
          value={String(metrics.totals.totalBuildings)}
          sub={`${activeSectors.length} active sectors`}
        />
        <MetricCard
          icon={Users}
          iconClass="text-emerald-500"
          label={`${peopleLabel} capacity`}
          value={metrics.totals.totalCapacity.toLocaleString()}
          sub="peak, from floor area"
        />
        <MetricCard
          icon={Activity}
          iconClass="text-amber-500"
          label={`Occupied at ${hourLabel}`}
          value={metrics.totals.occupancyNow.toLocaleString()}
          sub={`${metrics.totals.utilisation}% of capacity`}
        />
        <MetricCard
          icon={Route}
          iconClass="text-violet-500"
          label="Road network"
          value={`${metrics.totals.networkLength.toLocaleString()} m`}
          sub={`${metrics.totals.totalRoads} segments`}
        />
        <MetricCard
          icon={MapPin}
          iconClass="text-rose-500"
          label="Connected"
          value={`${metrics.totals.connectedShare}%`}
          sub={`avg ${metrics.totals.averageConnectivity} roads/building`}
        />
      </div>

      {metrics.totals.isolatedBuildings > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">
              {metrics.totals.isolatedBuildings}{' '}
              {metrics.totals.isolatedBuildings === 1 ? 'building has' : 'buildings have'}
            </strong>{' '}
            no road connection. Use <em>Add to city → Add route</em> to link them into the network.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Capacity vs occupancy by sector
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.sectorData} margin={{ top: 4, right: 4, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltip} cursor={{ fill: 'rgb(148 163 184 / 0.12)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="capacity" name="Capacity" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="occupancyNow" name={`At ${hourLabel}`} fill="#38bdf8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            Share of {peopleLabel.toLowerCase()} capacity
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.sectorData.filter(s => s.capacity > 0)}
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  innerRadius={48}
                  dataKey="capacity"
                  nameKey="label"
                  paddingAngle={2}
                >
                  {metrics.sectorData.filter(s => s.capacity > 0).map((entry) => (
                    <Cell key={entry.sector} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chartTooltip}
                  formatter={(value: number) => [value.toLocaleString(), 'Capacity']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Occupancy across the day
          </h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Modelled from each building&apos;s type and floor area
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.hourlyData} margin={{ top: 4, right: 8, bottom: 4, left: -6 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                <XAxis dataKey="hour" interval={2} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={chartTooltip}
                  formatter={(value: number) => [value.toLocaleString(), 'People']}
                />
                <Line
                  type="monotone"
                  dataKey="occupancy"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Sector detail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-5 py-2.5 font-medium">Sector</th>
                <th className="px-5 py-2.5 font-medium">Buildings</th>
                <th className="px-5 py-2.5 font-medium">{peopleLabel} capacity</th>
                <th className="px-5 py-2.5 font-medium">Utilisation now</th>
                <th className="px-5 py-2.5 font-medium">Roads</th>
                <th className="px-5 py-2.5 font-medium">Connectivity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {metrics.sectorData.map((sector) => (
                <tr key={sector.sector} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sector.color }} />
                      <span className="font-medium text-slate-900 dark:text-white">{sector.label}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {sector.buildings}
                    {sector.isolated > 0 && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                        {sector.isolated} unlinked
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {sector.capacity.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${sector.utilisation}%`, backgroundColor: sector.color }}
                        />
                      </span>
                      <span className="tabular-nums text-slate-700 dark:text-slate-300">
                        {sector.utilisation}%
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {sector.roads}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                    {sector.connectivity}
                  </td>
                </tr>
              ))}
              {metrics.sectorData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No active sectors. Enable some from the Sectors panel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Capacity is estimated from each building&apos;s footprint and height
          ({'≈'}3.5&nbsp;m per storey, 80% net-to-gross) against typical floor area per
          occupant for its type. Occupancy applies a per-type daily curve. Road and
          connectivity figures are measured directly from the network. These are planning
          estimates, not observed data.
        </span>
      </p>
    </div>
  );
}
