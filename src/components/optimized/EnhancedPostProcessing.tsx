import { useRef, useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  SMAA
} from '@react-three/postprocessing';
import { SMAAPreset } from 'postprocessing';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import { useCityStore } from '../../store/cityStore';
import * as THREE from 'three';

export function EnhancedPostProcessing() {
  const { timeOfDay, weather } = useCityStore();
  const composerRef = useRef<EffectComposerImpl>(null);

  const isNight = timeOfDay < 6 || timeOfDay > 18;

  // Minimal post-processing settings to avoid blur
  const effectSettings = useMemo(() => {
    let bloomIntensity = isNight ? 0.8 : 0.3; // Much reduced
    const bloomRadius = 0.2; // Very small radius

    // Weather adjustments (minimal)
    if (weather === 'rain') {
      bloomIntensity *= 0.8;
    } else if (weather === 'snow') {
      bloomIntensity *= 1.1;
    }

    return {
      bloom: {
        intensity: bloomIntensity,
        radius: bloomRadius,
        luminanceThreshold: 0.9, // High threshold to only affect very bright areas
        luminanceSmoothing: 0.5
      }
    };
  }, [weather, isNight]);

  // High quality settings
  const qualitySettings = useMemo(() => {
    return {
      // SMAAPreset is a numeric enum; the string 'ultra' silently matched
      // nothing and left SMAA on its default quality.
      smaaPreset: SMAAPreset.ULTRA,
      bloomResolution: 512,
      multisampling: 8
    };
  }, []);

  // EffectComposer types its children as Element | Element[], so a conditional
  // child (`{isNight && <Bloom/>}`) or a JSX comment would widen the array to
  // include false/undefined. Build the list instead.
  const effects = [
    // High-quality anti-aliasing only
    <SMAA key="smaa" preset={qualitySettings.smaaPreset} />
  ];

  // Minimal bloom only for lights at night
  if (isNight) {
    effects.push(
      <Bloom
        key="bloom"
        intensity={effectSettings.bloom.intensity}
        radius={effectSettings.bloom.radius}
        luminanceThreshold={effectSettings.bloom.luminanceThreshold}
        luminanceSmoothing={effectSettings.bloom.luminanceSmoothing}
        mipmapBlur={false}
        resolutionX={qualitySettings.bloomResolution}
        resolutionY={qualitySettings.bloomResolution}
      />
    );
  }

  return (
    <EffectComposer
      ref={composerRef}
      multisampling={qualitySettings.multisampling}
      frameBufferType={THREE.HalfFloatType}
      stencilBuffer={false}
      depthBuffer={true}
    >
      {effects}
    </EffectComposer>
  );
}