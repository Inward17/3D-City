import { CityData } from '../types/city';

export const corporateCampusData: CityData = {
  locations: [
    // Admin Block
    {
      id: 'admin1',
      name: 'Main Office Building',
      type: 'Building',
      position: [0, 0, 0],
      description: 'Corporate headquarters with executive offices.',
      color: '#3b82f6',
      zone: 'admin'
    },
    {
      id: 'admin2',
      name: 'HR & Finance Block',
      type: 'Building',
      position: [50, 0, 30],
      description: 'Administrative offices for HR and Finance departments.',
      color: '#1d4ed8',
      zone: 'admin'
    },

    // R&D Units
    {
      id: 'rd1',
      name: 'Research Lab A',
      type: 'Building',
      position: [150, 0, 150],
      description: 'Advanced research and development facility.',
      color: '#ef4444',
      zone: 'research'
    },
    {
      id: 'rd2',
      name: 'Innovation Center',
      type: 'Building',
      position: [200, 0, 180],
      description: 'Collaborative space for innovation and prototyping.',
      color: '#ef4444',
      zone: 'research'
    },

    // Conference Facilities
    {
      id: 'conf1',
      name: 'Main Conference Hall',
      type: 'Building',
      position: [-150, 0, 150],
      description: 'Large conference facility for corporate events.',
      color: '#84cc16',
      zone: 'conference'
    },
    {
      id: 'conf2',
      name: 'Training Center',
      type: 'Building',
      position: [-200, 0, 180],
      description: 'Employee training and development center.',
      color: '#fb923c',
      zone: 'conference'
    },

    // Cafeteria
    {
      id: 'cafe1',
      name: 'Main Cafeteria',
      type: 'Restaurant',
      position: [150, 0, -150],
      description: 'Central dining facility for employees.',
      color: '#a78bfa',
      zone: 'cafeteria'
    },
    {
      id: 'cafe2',
      name: 'Coffee Shop',
      type: 'Cafe',
      position: [180, 0, -180],
      description: 'Casual coffee shop and break area.',
      color: '#60a5fa',
      zone: 'cafeteria'
    },

    // Clinic
    {
      id: 'clinic1',
      name: 'Medical Center',
      type: 'Hospital',
      position: [-150, 0, -150],
      description: 'On-site medical facility for employees.',
      color: '#8b5cf6',
      zone: 'clinic'
    },

    // Parking
    {
      id: 'park1',
      name: 'Main Parking Structure',
      type: 'Building',
      position: [0, 0, -200],
      description: 'Multi-level employee parking facility.',
      color: '#4ade80',
      zone: 'parking'
    },
    {
      id: 'park2',
      name: 'Visitor Parking',
      type: 'Building',
      position: [0, 0, -250],
      description: 'Dedicated visitor parking area.',
      color: '#4ade80',
      zone: 'parking'
    },

    // Security
    {
      id: 'sec1',
      name: 'Security Command Center',
      type: 'Building',
      position: [250, 0, 0],
      description: 'Main security operations center.',
      color: '#64748b',
      zone: 'security'
    },
    {
      id: 'sec2',
      name: 'Entry Gate Complex',
      type: 'Building',
      position: [280, 0, 30],
      description: 'Main entrance security checkpoint.',
      color: '#64748b',
      zone: 'security'
    }
  ],
  roads: [
    // Main campus roads
    {
      id: 'r1',
      from: 'admin1',
      to: 'rd1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r2',
      from: 'admin1',
      to: 'conf1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r3',
      from: 'admin1',
      to: 'cafe1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r4',
      from: 'admin1',
      to: 'clinic1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r5',
      from: 'park1',
      to: 'admin1',
      distance: 4000,
      type: 'main'
    },
    {
      id: 'r6',
      from: 'sec1',
      to: 'admin1',
      distance: 4000,
      type: 'main'
    },

    // Secondary connections
    {
      id: 'r7',
      from: 'rd1',
      to: 'rd2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r8',
      from: 'conf1',
      to: 'conf2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r9',
      from: 'cafe1',
      to: 'cafe2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r10',
      from: 'park1',
      to: 'park2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r11',
      from: 'sec1',
      to: 'sec2',
      distance: 2000,
      type: 'main'
    }
  ]
};