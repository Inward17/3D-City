import { Color } from 'three';

/** An [x, y, z] triple, as three.js and R3F expect for positions and scales. */
export type Vec3 = [number, number, number];

export type ZoneType =
  // City Planning Types
  | 'residential'
  | 'industrial'
  | 'commercial'
  | 'healthcare'
  | 'education'
  | 'government'
  | 'transportation'
  | 'green'
  // Corporate Campus Types
  | 'admin'
  | 'research'
  | 'conference'
  | 'cafeteria'
  | 'clinic'
  | 'parking'
  | 'security';

export interface BuildingDensity {
  current: number;
  max: number;
  utilization: number;
}

export interface TrafficFlow {
  volume: number;
  capacity: number;
  peakHours: number[];
}

export interface ZoneStatistics {
  population?: number;
  employmentRate?: number;
  trafficDensity: number;
  buildingDensity: BuildingDensity;
  averageHeight: number;
  landValue: number;
}

export interface SecurityZone {
  level: 1 | 2 | 3 | 4 | 5;
  accessPoints: string[];
  restrictedAreas: string[];
}

export interface EmployeeAllocation {
  capacity: number;
  current: number;
  departments: string[];
}

export type RoofStyle = 'flat' | 'pitched' | 'stepped';

/**
 * Per-building design overrides.
 *
 * Everything is optional: an absent field falls back to the type's default
 * footprint, so existing data keeps rendering exactly as before.
 */
export interface BuildingDesign {
  /** Footprint across X, in metres. */
  width?: number;
  /** Footprint across Z, in metres. */
  depth?: number;
  /** Storey count; drives height at STOREY_HEIGHT metres each. */
  floors?: number;
  /** Overrides the facade colour. */
  color?: string;
  roof?: RoofStyle;
  /**
   * Occupant capacity, overriding the value derived from floor area.
   *
   * The geometric estimate is a reasonable default but can't know that a block
   * is half-empty, or that a depot holds far fewer people than its volume
   * suggests. Setting this pins the number; clearing it returns to the derived
   * value.
   */
  population?: number;
}

export interface Location {
  id: string;
  name: string;
  type: 'Park' | 'Museum' | 'Restaurant' | 'Building' | 'Shop' | 'School' | 'Hospital' | 'Library' | 'Cafe' | 'Hotel';
  position: [number, number, number];
  description: string;
  color?: string;
  zone?: ZoneType;
  /** User customisations from the design editor. */
  design?: BuildingDesign;
  statistics?: ZoneStatistics;
  security?: SecurityZone;
  employees?: EmployeeAllocation;
  overlay?: {
    color: Color;
    opacity: number;
    height: number;
  };
}

export interface Road {
  id: string;
  from: string;
  to: string;
  distance: number;
  type: 'main' | 'secondary' | 'residential';
  traffic?: TrafficFlow;
}

export interface CityData {
  locations: Location[];
  roads: Road[];
  modelType?: 'planning' | 'corporate';
}

export interface ZoneOverlay {
  id: string;
  type: ZoneType;
  color: string;
  opacity: number;
  bounds: {
    min: [number, number];
    max: [number, number];
  };
}