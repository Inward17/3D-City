import { CityData } from '../types/city';

export const cityData: CityData = {
  locations: [
    {
      id: '1',
      name: 'Central Park',
      type: 'Park',
      position: [0, 0, 0],
      description: 'A beautiful urban park with walking trails and recreational areas.',
      color: '#4ade80'
    },
    {
      id: '2',
      name: 'City Museum',
      type: 'Museum',
      position: [15, 0, 8],
      description: 'Modern museum featuring local history and contemporary art.',
      color: '#f472b6'
    },
    {
      id: '3',
      name: 'Sky Tower',
      type: 'Building',
      position: [-12, 0, 15],
      description: 'Iconic skyscraper with observation deck and offices.',
      color: '#60a5fa'
    },
    {
      id: '4',
      name: 'Riverside Restaurant',
      type: 'Restaurant',
      position: [12, 0, -10],
      description: 'Fine dining with scenic river views.',
      color: '#fbbf24'
    },
    {
      id: '5',
      name: 'Downtown Shopping Mall',
      type: 'Shop',
      position: [-15, 0, -8],
      description: 'Modern shopping center with various retail stores.',
      color: '#a78bfa'
    },
    {
      id: '6',
      name: 'City High School',
      type: 'School',
      position: [8, 0, 18],
      description: 'Public high school serving the local community.',
      color: '#fb923c'
    },
    {
      id: '7',
      name: 'General Hospital',
      type: 'Hospital',
      position: [-20, 0, 0],
      description: '24-hour medical facility with emergency services.',
      color: '#ef4444'
    },
    {
      id: '8',
      name: 'Public Library',
      type: 'Library',
      position: [6, 0, -20],
      description: 'Modern library with extensive book collection and study areas.',
      color: '#84cc16'
    },
    {
      id: '9',
      name: 'Corner Cafe',
      type: 'Cafe',
      position: [-8, 0, -12],
      description: 'Cozy cafe serving fresh coffee and pastries.',
      color: '#f97316'
    },
    {
      id: '10',
      name: 'Grand Hotel',
      type: 'Hotel',
      position: [18, 0, -5],
      description: 'Luxury hotel with panoramic city views.',
      color: '#06b6d4'
    },
    {
      id: '11',
      name: 'Tech Hub',
      type: 'Building',
      position: [-18, 0, 20],
      description: 'Modern office complex housing tech startups.',
      color: '#3b82f6'
    },
    {
      id: '12',
      name: 'Fashion Boutique',
      type: 'Shop',
      position: [20, 0, 20],
      description: 'High-end fashion retail store.',
      color: '#d946ef'
    },
    {
      id: '13',
      name: 'Sushi Restaurant',
      type: 'Restaurant',
      position: [-20, 0, -20],
      description: 'Contemporary Japanese dining experience.',
      color: '#f59e0b'
    },
    {
      id: '14',
      name: 'Art Gallery',
      type: 'Museum',
      position: [20, 0, -20],
      description: 'Contemporary art gallery featuring local artists.',
      color: '#ec4899'
    },
    {
      id: '15',
      name: 'Business Center',
      type: 'Building',
      position: [0, 0, 25],
      description: 'Corporate office building with modern amenities.',
      color: '#6366f1'
    },
    {
      id: '16',
      name: 'Community College',
      type: 'School',
      position: [0, 0, -25],
      description: 'Educational institution offering diverse programs.',
      color: '#ea580c'
    },
    {
      id: '17',
      name: 'Boutique Hotel',
      type: 'Hotel',
      position: [-25, 0, 0],
      description: 'Charming boutique hotel with unique character.',
      color: '#0891b2'
    },
    {
      id: '18',
      name: 'Bookstore Cafe',
      type: 'Cafe',
      position: [25, 0, 0],
      description: 'Cozy cafe with extensive book collection.',
      color: '#d97706'
    },
    {
      id: '19',
      name: 'Electronics Store',
      type: 'Shop',
      position: [12, 0, 12],
      description: 'Retail store specializing in electronics.',
      color: '#7c3aed'
    },
    {
      id: '20',
      name: 'Urban Park',
      type: 'Park',
      position: [-12, 0, -12],
      description: 'Small urban park with recreational facilities.',
      color: '#22c55e'
    }
  ],
  roads: [
    // Main arterial roads
    {
      id: 'r1',
      from: '1',
      to: '2',
      distance: 500,
      type: 'main'
    },
    {
      id: 'r2',
      from: '1',
      to: '3',
      distance: 400,
      type: 'main'
    },
    {
      id: 'r3',
      from: '1',
      to: '7',
      distance: 600,
      type: 'main'
    },
    {
      id: 'r4',
      from: '1',
      to: '5',
      distance: 450,
      type: 'main'
    },
    {
      id: 'r5',
      from: '2',
      to: '10',
      distance: 350,
      type: 'main'
    },
    {
      id: 'r6',
      from: '7',
      to: '3',
      distance: 400,
      type: 'main'
    },
    {
      id: 'r7',
      from: '10',
      to: '4',
      distance: 300,
      type: 'main'
    },
    // Secondary roads
    {
      id: 'r8',
      from: '2',
      to: '6',
      distance: 400,
      type: 'secondary'
    },
    {
      id: 'r9',
      from: '2',
      to: '4',
      distance: 350,
      type: 'secondary'
    },
    {
      id: 'r10',
      from: '3',
      to: '4',
      distance: 450,
      type: 'secondary'
    },
    {
      id: 'r11',
      from: '5',
      to: '7',
      distance: 300,
      type: 'secondary'
    },
    {
      id: 'r12',
      from: '8',
      to: '4',
      distance: 250,
      type: 'secondary'
    },
    {
      id: 'r13',
      from: '6',
      to: '3',
      distance: 350,
      type: 'secondary'
    },
    // Residential roads
    {
      id: 'r14',
      from: '5',
      to: '9',
      distance: 200,
      type: 'residential'
    },
    {
      id: 'r15',
      from: '9',
      to: '8',
      distance: 300,
      type: 'residential'
    },
    {
      id: 'r16',
      from: '9',
      to: '4',
      distance: 250,
      type: 'residential'
    },
    {
      id: 'r17',
      from: '8',
      to: '5',
      distance: 400,
      type: 'residential'
    },
    {
      id: 'r18',
      from: '6',
      to: '10',
      distance: 350,
      type: 'residential'
    },
    // Ring road
    {
      id: 'r19',
      from: '7',
      to: '8',
      distance: 500,
      type: 'main'
    },
    {
      id: 'r20',
      from: '10',
      to: '6',
      distance: 450,
      type: 'main'
    },
    // New connections for additional buildings
    {
      id: 'r21',
      from: '11',
      to: '15',
      distance: 400,
      type: 'main'
    },
    {
      id: 'r22',
      from: '12',
      to: '15',
      distance: 350,
      type: 'main'
    },
    {
      id: 'r23',
      from: '13',
      to: '16',
      distance: 400,
      type: 'main'
    },
    {
      id: 'r24',
      from: '14',
      to: '16',
      distance: 350,
      type: 'main'
    },
    {
      id: 'r25',
      from: '17',
      to: '7',
      distance: 300,
      type: 'secondary'
    },
    {
      id: 'r26',
      from: '18',
      to: '2',
      distance: 300,
      type: 'secondary'
    },
    {
      id: 'r27',
      from: '19',
      to: '15',
      distance: 250,
      type: 'residential'
    },
    {
      id: 'r28',
      from: '20',
      to: '16',
      distance: 250,
      type: 'residential'
    }
  ]
};