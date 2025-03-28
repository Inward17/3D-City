export interface Location {
  id: string;
  name: string;
  type: 'Park' | 'Museum' | 'Restaurant' | 'Building' | 'Shop' | 'School' | 'Hospital' | 'Library' | 'Cafe' | 'Hotel';
  position: [number, number, number];
  description: string;
  color?: string;
}

export interface Road {
  id: string;
  from: string;
  to: string;
  distance: number;
  type: 'main' | 'secondary' | 'residential';
}

export interface CityData {
  locations: Location[];
  roads: Road[];
}