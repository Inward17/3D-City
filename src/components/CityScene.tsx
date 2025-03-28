import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Environment, Stars, Cloud } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Locations } from './Locations';
import { Roads } from './Roads';
import { Terrain } from './Terrain';
import { Traffic } from './Traffic';
import { Vegetation } from './Vegetation';
import { Weather } from './Weather';
import { useCityStore } from '../store/cityStore';
import { useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';

function SceneContent() {
  const { timeOfDay, setTimeOfDay, weather } = useCityStore();

  // Improved day/night cycle using delta time
  const updateTimeOfDay = useCallback((delta: number) => {
    setTimeOfDay((prev) => (prev + delta * 0.1) % 24);
  }, [setTimeOfDay]);

  const sunPosition = useMemo(() => {
    const angle = (timeOfDay - 12) * (Math.PI / 12);
    return [
      Math.cos(angle) * 100,
      Math.sin(angle) * 100,
      0
    ];
  }, [timeOfDay]);

  const isNight = timeOfDay < 6 || timeOfDay > 18;

  // Dynamic lighting based on time and weather
  const ambientIntensity = useMemo(() => {
    let base = isNight ? 0.1 : 0.5;
    if (weather === 'rain') base *= 0.7;
    if (weather === 'snow') base *= 0.9;
    return base;
  }, [isNight, weather]);

  const directionalIntensity = useMemo(() => {
    let base = isNight ? 0.1 : 1;
    if (weather === 'rain') base *= 0.5;
    if (weather === 'snow') base *= 0.7;
    return base;
  }, [isNight, weather]);

  return (
    <>
      <PerspectiveCamera 
        makeDefault 
        position={[20, 20, 20]} 
        far={1000}
      />
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={100}
      />
      
      {/* Enhanced lighting system */}
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={sunPosition}
        intensity={directionalIntensity}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-far={100}
        shadow-camera-near={1}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      
      {/* Dynamic atmospheric effects */}
      {isNight ? (
        <>
          <Stars 
            radius={100} 
            depth={50} 
            count={5000} 
            factor={4} 
            fade 
            speed={1}
          />
          <Environment preset="night" />
        </>
      ) : (
        <>
          <Sky 
            sunPosition={sunPosition} 
            turbidity={weather === 'rain' ? 10 : weather === 'snow' ? 8 : 6}
            rayleigh={weather === 'rain' ? 3 : 1}
          />
          <Environment preset={weather === 'rain' ? 'city' : 'sunset'} />
          {weather === 'clear' && (
            <Cloud 
              opacity={0.5}
              speed={0.4}
              width={100}
              depth={1.5}
              segments={20}
            />
          )}
        </>
      )}
      
      {/* Enhanced post-processing */}
      <EffectComposer>
        <Bloom 
          intensity={isNight ? 1.5 : 1}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
      
      {/* Scene components */}
      <Terrain />
      <Locations />
      <Roads />
      <Traffic />
      <Vegetation />
      <Weather />
    </>
  );
}

export function CityScene() {
  return (
    <Canvas 
      shadows 
      gl={{ 
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false
      }}
      camera={{ fov: 75, near: 0.1, far: 1000 }}
      performance={{ min: 0.5 }}
    >
      <SceneContent />
    </Canvas>
  );
}