import { useCityStore } from '../store/cityStore';
import { Building, Trees, Landmark, UtensilsCrossed, Store, School, Guitar as Hospital, Library, Coffee, Hotel, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

// Generate occupancy data based on time and building type
function generateOccupancyData(type: string, currentTime: number) {
  const data = [];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const getBaseOccupancy = (hour: number, type: string) => {
    switch (type) {
      case 'Office':
        return hour >= 9 && hour <= 17 ? 80 : hour >= 7 && hour <= 19 ? 40 : 10;
      case 'Restaurant':
        return (hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21) ? 90 : 30;
      case 'Shop':
        return hour >= 10 && hour <= 20 ? 70 : 0;
      case 'School':
        return hour >= 8 && hour <= 15 ? 95 : hour >= 15 && hour <= 17 ? 40 : 5;
      case 'Hospital':
        return 60 + Math.sin(hour * Math.PI / 12) * 20;
      case 'Library':
        return hour >= 9 && hour <= 18 ? 50 + Math.sin(hour * Math.PI / 9) * 30 : 10;
      case 'Cafe':
        return (hour >= 7 && hour <= 10) || (hour >= 12 && hour <= 14) ? 85 : 40;
      case 'Hotel':
        return hour >= 22 || hour <= 6 ? 90 : 50;
      default:
        return 50;
    }
  };

  hours.forEach(hour => {
    const baseOccupancy = getBaseOccupancy(hour, type);
    const randomVariation = Math.random() * 20 - 10;
    const occupancy = Math.min(100, Math.max(0, baseOccupancy + randomVariation));
    
    // Highlight current hour
    const isCurrent = Math.floor(currentTime) === hour;
    
    data.push({
      hour: hour.toString().padStart(2, '0') + ':00',
      occupancy: Math.round(occupancy),
      isCurrent,
    });
  });

  return data;
}

export function LocationInfo() {
  const { selectedLocation, setSelectedLocation, timeOfDay } = useCityStore();

  if (!selectedLocation) return null;

  const Icon = typeIcons[selectedLocation.type] || Building;
  const occupancyData = generateOccupancyData(selectedLocation.type, timeOfDay);
  const currentOccupancy = occupancyData.find(d => d.isCurrent)?.occupancy || 0;

  return (
    <div
      className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg max-w-md transform transition-all duration-300 ease-in-out"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h2 className="text-xl font-bold">{selectedLocation.name}</h2>
        </div>
        <button
          onClick={() => setSelectedLocation(null)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Type: {selectedLocation.type}</p>
          <p className="text-sm">{selectedLocation.description}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Current Occupancy</h3>
            <span className="text-lg font-bold text-blue-600">{currentOccupancy}%</span>
          </div>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={occupancyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour"
                  interval={3}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Occupancy']}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="occupancy"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}