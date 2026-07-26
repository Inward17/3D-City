import React from 'react';
import { Check, Building, Briefcase, School, Guitar as Hospital, Trees as Tree, Clover as Government, Train, Factory, Coffee, Video, Car, Shield } from 'lucide-react';

interface Sector {
  id: string;
  label: string;
  icon: React.ElementType;
  description?: string;
}

const cityPlanningSectors: Sector[] = [
  { id: 'residential', label: 'Residential', icon: Building, description: 'Housing and accommodation zones' },
  { id: 'commercial', label: 'Commercial', icon: Building, description: 'Business and retail areas' },
  { id: 'industrial', label: 'Industrial', icon: Factory, description: 'Manufacturing and production zones' },
  { id: 'education', label: 'Education', icon: School, description: 'Schools, universities, and learning centers' },
  { id: 'healthcare', label: 'Healthcare', icon: Hospital, description: 'Hospitals and medical facilities' },
  { id: 'green', label: 'Green Spaces', icon: Tree, description: 'Parks and recreational areas' },
  { id: 'government', label: 'Government', icon: Government, description: 'Administrative and civic buildings' },
  { id: 'transportation', label: 'Transportation', icon: Train, description: 'Transit hubs and infrastructure' }
];

const corporateSectors: Sector[] = [
  { id: 'admin', label: 'Admin Block', icon: Building, description: 'Administrative offices and management' },
  { id: 'research', label: 'R&D Unit', icon: Briefcase, description: 'Research and development facilities' },
  { id: 'cafeteria', label: 'Cafeteria', icon: Coffee, description: 'Dining areas and food services' },
  { id: 'conference', label: 'Conference Hall', icon: Video, description: 'Meeting spaces and event venues' },
  { id: 'clinic', label: 'Clinic', icon: Hospital, description: 'On-site medical facilities' },
  { id: 'parking', label: 'Parking', icon: Car, description: 'Parking facilities and structures' },
  { id: 'security', label: 'Security Zone', icon: Shield, description: 'Security checkpoints and monitoring' }
];

interface SectorSelectorProps {
  modelType: 'planning' | 'corporate';
  selectedSectors: string[];
  onChange: (sectors: string[]) => void;
  className?: string;
  showDescription?: boolean;
  compact?: boolean;
}

export function SectorSelector({
  modelType,
  selectedSectors,
  onChange,
  className = '',
  showDescription = false,
  compact = false
}: SectorSelectorProps) {
  const sectors = modelType === 'planning' ? cityPlanningSectors : corporateSectors;

  const toggleSector = (sectorId: string) => {
    const isSelected = selectedSectors.includes(sectorId);
    const newSectors = isSelected
      ? selectedSectors.filter(id => id !== sectorId)
      : [...selectedSectors, sectorId];
    onChange(newSectors);
  };

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {sectors.map(sector => {
          const Icon = sector.icon;
          const isSelected = selectedSectors.includes(sector.id);
          
          return (
            <button
              key={sector.id}
              type="button"
              onClick={() => toggleSector(sector.id)}
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors ${
                isSelected
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className="h-4 w-4 mr-1" />
              {sector.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      {sectors.map(sector => {
        const Icon = sector.icon;
        const isSelected = selectedSectors.includes(sector.id);
        
        return (
          <button
            key={sector.id}
            // Without this the button defaults to type="submit" and picking a
            // sector immediately submits the create-project form.
            type="button"
            onClick={() => toggleSector(sector.id)}
            className={`flex items-center p-3 border-2 rounded-lg transition-colors ${
              isSelected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
            }`}
          >
            <Icon className="h-5 w-5 mr-2 text-gray-700 dark:text-gray-300" />
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900 dark:text-white">{sector.label}</div>
              {showDescription && sector.description && (
                <div className="text-sm text-gray-500 dark:text-gray-400">{sector.description}</div>
              )}
            </div>
            {isSelected && (
              <Check className="h-5 w-5 text-blue-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}