import { CityData } from '../types/city';

export const cityPlanningData: CityData = {
  locations: [
    // Government District
    {
      id: 'gov1',
      name: 'City Hall',
      type: 'Building',
      position: [0, 0, 0],
      description: 'The central administrative building of the city.',
      color: '#3b82f6',
      zone: 'government'
    },
    {
      id: 'gov2',
      name: 'Police Headquarters',
      type: 'Building',
      position: [50, 0, 30],
      description: 'Main police station serving the city.',
      color: '#1d4ed8',
      zone: 'government'
    },

    // Healthcare District
    {
      id: 'health1',
      name: 'Central Hospital',
      type: 'Hospital',
      position: [150, 0, 150],
      description: 'Major medical facility with emergency and specialist care.',
      color: '#ef4444',
      zone: 'healthcare'
    },
    {
      id: 'health2',
      name: 'Medical Center',
      type: 'Hospital',
      position: [200, 0, 180],
      description: 'Modern healthcare facility with outpatient services.',
      color: '#ef4444',
      zone: 'healthcare'
    },

    // Educational District
    {
      id: 'edu1',
      name: 'Public Library',
      type: 'Library',
      position: [-150, 0, 150],
      description: 'Main library with extensive collection and study areas.',
      color: '#84cc16',
      zone: 'education'
    },
    {
      id: 'edu2',
      name: 'High School',
      type: 'School',
      position: [-200, 0, 180],
      description: 'Public high school with modern facilities.',
      color: '#fb923c',
      zone: 'education'
    },

    // Commercial District
    {
      id: 'com1',
      name: 'Shopping Mall',
      type: 'Shop',
      position: [150, 0, -150],
      description: 'Large retail complex with diverse stores.',
      color: '#a78bfa',
      zone: 'commercial'
    },
    {
      id: 'com2',
      name: 'Office Tower',
      type: 'Building',
      position: [180, 0, -180],
      description: 'Modern office building housing various businesses.',
      color: '#60a5fa',
      zone: 'commercial'
    },

    // Residential District
    {
      id: 'res1',
      name: 'Apartment Complex',
      type: 'Building',
      position: [-150, 0, -150],
      description: 'Modern residential complex with amenities.',
      color: '#8b5cf6',
      zone: 'residential'
    },
    {
      id: 'res2',
      name: 'Hotel District',
      type: 'Hotel',
      position: [-180, 0, -180],
      description: 'Upscale hotels and accommodations.',
      color: '#06b6d4',
      zone: 'residential'
    },

    // Green Spaces
    {
      id: 'green1',
      name: 'Central Park',
      type: 'Park',
      position: [0, 0, -200],
      description: 'Large urban park with recreational facilities.',
      color: '#4ade80',
      zone: 'green'
    },
    {
      id: 'green2',
      name: 'Botanical Gardens',
      type: 'Park',
      position: [0, 0, -250],
      description: 'Beautiful gardens with diverse plant species.',
      color: '#4ade80',
      zone: 'green'
    },

    // Transportation Hub
    {
      id: 'trans1',
      name: 'Central Station',
      type: 'Building',
      position: [250, 0, 0],
      description: 'Main transportation hub connecting the city.',
      color: '#64748b',
      zone: 'transportation'
    },
    {
      id: 'trans2',
      name: 'Bus Terminal',
      type: 'Building',
      position: [280, 0, 30],
      description: 'Central bus station serving the city.',
      color: '#64748b',
      zone: 'transportation'
    }
  ],
  roads: [
    // Main arterial roads
    {
      id: 'r1',
      from: 'gov1',
      to: 'health1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r2',
      from: 'gov1',
      to: 'edu1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r3',
      from: 'gov1',
      to: 'com1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r4',
      from: 'gov1',
      to: 'res1',
      distance: 5000,
      type: 'main'
    },
    {
      id: 'r5',
      from: 'green1',
      to: 'gov1',
      distance: 4000,
      type: 'main'
    },
    {
      id: 'r6',
      from: 'trans1',
      to: 'gov1',
      distance: 4000,
      type: 'main'
    },

    // Secondary connections
    {
      id: 'r7',
      from: 'health1',
      to: 'health2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r8',
      from: 'edu1',
      to: 'edu2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r9',
      from: 'com1',
      to: 'com2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r10',
      from: 'res1',
      to: 'res2',
      distance: 2000,
      type: 'secondary'
    },
    {
      id: 'r11',
      from: 'green1',
      to: 'green2',
      distance: 2000,
      type: 'residential'
    },
    {
      id: 'r12',
      from: 'trans1',
      to: 'trans2',
      distance: 2000,
      type: 'main'
    },

    /*
      Orbital route.

      Without it this layout is a pure star: every road ran to City Hall, so the
      only path between any two districts was through the middle of the city and
      every vehicle in the model funnelled across one junction. Real networks are
      radial *and* orbital — you drive round, not through, unless the centre is
      actually where you are going.

      It also gives the assignment a genuine choice of route, which a tree never
      can: with one path per journey, congestion cannot redistribute anything.
    */
    {
      id: 'r13',
      from: 'edu1',
      to: 'health1',
      distance: 3000,
      type: 'main'
    },
    {
      id: 'r14',
      from: 'health1',
      to: 'trans1',
      distance: 1800,
      type: 'main'
    },
    {
      id: 'r15',
      from: 'trans1',
      to: 'com1',
      distance: 1800,
      type: 'main'
    },
    {
      id: 'r16',
      from: 'com1',
      to: 'green1',
      distance: 1600,
      type: 'secondary'
    },
    {
      id: 'r17',
      from: 'green1',
      to: 'res1',
      distance: 1600,
      type: 'secondary'
    },
    {
      id: 'r18',
      from: 'res1',
      to: 'edu1',
      distance: 3000,
      type: 'main'
    },

    // Police Headquarters had no road at all, so it generated no trips and
    // counted as isolated in the analytics.
    {
      id: 'r19',
      from: 'gov1',
      to: 'gov2',
      distance: 600,
      type: 'secondary'
    },
    {
      id: 'r20',
      from: 'gov2',
      to: 'trans1',
      distance: 2000,
      type: 'secondary'
    }
  ]
};
