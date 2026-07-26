import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Suspense } from 'react';
import { EnvironmentLayer } from './layers/Environment';
import { BuildingsLayer } from './layers/Buildings';
import { RoadsLayer } from './layers/Roads';
import { RoutePreview } from './layers/RoutePreview';
import { UILayer } from './layers/UI';
import { SmoothCameraControls } from './optimized/SmoothCameraControls';
import { EnhancedPostProcessing } from './optimized/EnhancedPostProcessing';
import { InstancedVegetation } from './optimized/InstancedVegetation';
import { InstancedStreetAssets } from './optimized/InstancedStreetAssets';
import { InstancedVehicles } from './optimized/InstancedVehicles';
import { Terrain } from './Terrain';
import { Weather } from './Weather';
import { Location, Road } from '../types/city';
import * as THREE from 'three';

interface CitySceneProps {
  locations: Location[];
  roads: Road[];
}

function SceneContent({ locations, roads }: CitySceneProps) {
  return (
    <Suspense fallback={null}>
      {/* Camera. Positioned for a city spanning ~±250 units; the old
          [20,20,20] / far=1000 put the viewer inside the first block with the
          far plane cutting through the map. */}
      <PerspectiveCamera
        makeDefault
        position={[260, 200, 260]}
        fov={55}
        near={1}
        far={6000}
      />

      {/* Enhanced Camera Controls */}
      <SmoothCameraControls />

      {/* Environment layer - lighting, sky, fog */}
      <EnvironmentLayer />

      {/* Terrain base */}
      <Terrain />

      {/* Buildings layer - back to original with optimizations */}
      <BuildingsLayer locations={locations} />

      {/* Roads layer - spline-based roads */}
      <RoadsLayer locations={locations} roads={roads} />

      {/* Rubber-band line while drawing a new route */}
      <RoutePreview locations={locations} />

      {/* Optimized instanced elements - single draw calls */}
      <InstancedStreetAssets locations={locations} roads={roads} />
      <InstancedVehicles locations={locations} roads={roads} />
      <InstancedVegetation locations={locations} roads={roads} />
      <Weather locations={locations} />

      {/* UI layer - tooltips and overlays */}
      <UILayer locations={locations} />

      {/* Minimal Post-Processing */}
      <EnhancedPostProcessing />
    </Suspense>
  );
}

export function CityScene({ locations, roads }: CitySceneProps) {
  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        // Fix blurriness with proper pixel ratio
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        // Ensure proper color space
        outputColorSpace: THREE.SRGBColorSpace,
        // Improve rendering quality
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0
      }}
      performance={{ min: 0.5 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent locations={locations} roads={roads} />
    </Canvas>
  );
}