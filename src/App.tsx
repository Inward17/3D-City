import React from 'react';
import { CityScene } from './components/CityScene';
import { LocationInfo } from './components/LocationInfo';
import { CityControls } from './components/CityControls';

function App() {
  return (
    <div className="w-full h-screen relative">
      <CityScene />
      <LocationInfo />
      <CityControls />
    </div>
  );
}

export default App