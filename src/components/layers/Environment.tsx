import { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { useCityStore } from '../../store/cityStore';
import { sunPosition } from '../../utils/solar';
import * as THREE from 'three';

/**
 * Sun elevation for a given hour. 6 = sunrise, 12 = noon, 18 = sunset.
 * Returns a unit-ish vector scaled out to sky distance.
 */
/** How far out the light is placed; only the direction carries meaning. */
const SUN_DISTANCE = 400;

export function EnvironmentLayer() {
  const { timeOfDay, weather, latitude, dayOfYear } = useCityStore();
  const { scene } = useThree();

  /*
    The real sun for this site and date, rather than a fixed east-west arc that
    put noon overhead everywhere on Earth on every day of the year. Sunrise and
    sunset now move with the season and the latitude, so the shadows a building
    casts are the ones it will actually cast.
  */
  const sun = useMemo(
    () => sunPosition(latitude, dayOfYear, timeOfDay),
    [latitude, dayOfYear, timeOfDay]
  );

  const isNight = !sun.isUp;
  // Low sun: warm light and long shadows, whatever the clock says.
  const isGolden = sun.isUp && sun.elevation < 12;

  const sunPositionVector = useMemo<[number, number, number]>(
    () => [
      sun.direction[0] * SUN_DISTANCE,
      // Keep the light above the horizon after dark so the moonlight stand-in
      // still shapes the buildings instead of lighting them from underneath.
      Math.max(sun.direction[1], 0.25) * SUN_DISTANCE,
      sun.direction[2] * SUN_DISTANCE
    ],
    [sun]
  );

  /*
    Night used to bottom out around 0.28 ambient with a 0.1 sun and a near-black
    fog colour, which crushed the whole city into an unreadable silhouette.
    The floor is now high enough to keep facades and streets legible while
    still reading clearly as night.
  */
  const ambientIntensity = useMemo(() => {
    let base = isNight ? 0.62 : 0.55;
    if (weather === 'rain') base *= 0.8;
    if (weather === 'snow') base *= 1.05;
    return base;
  }, [isNight, weather]);

  const sunIntensity = useMemo(() => {
    // At night this stands in for moonlight: enough to shape the buildings.
    let base = isNight ? 0.45 : isGolden ? 1.5 : 2.2;
    if (weather === 'rain') base *= 0.5;
    if (weather === 'snow') base *= 0.7;
    return base;
  }, [isNight, isGolden, weather]);

  const sunColor = isNight ? '#aebde8' : isGolden ? '#ffb375' : '#fff6e8';

  /**
   * Fog. The previous setup used near=10/far=200 on a city spanning roughly
   * ±250 units, so everything past the centre block was swallowed by solid fog
   * — a large part of why the scene looked empty. These ranges are tied to the
   * actual city extent, and the effect only sets fog once per change instead of
   * fighting Weather.tsx for it every frame.
   */
  useEffect(() => {
    const config = (() => {
      if (weather === 'rain') return { color: '#5f7183', near: 260, far: 1500 };
      if (weather === 'snow') return { color: '#c3cdd8', near: 300, far: 1700 };
      // A navy horizon rather than near-black: distant buildings still
      // separate from the sky instead of dissolving into it.
      if (isNight) return { color: '#1c2947', near: 380, far: 2200 };
      if (isGolden) return { color: '#d9a878', near: 380, far: 2100 };
      return { color: '#9fc3d9', near: 420, far: 2400 };
    })();

    scene.fog = new THREE.Fog(config.color, config.near, config.far);
    scene.background = new THREE.Color(config.color);

    return () => {
      scene.fog = null;
    };
  }, [scene, weather, isNight, isGolden]);

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={isNight ? '#5b6b8f' : '#ffffff'} />

      {/* Key light / sun. Shadow frustum sized to the city rather than the old
          ±100 box, which clipped shadows off most of the map. */}
      <directionalLight
        position={sunPositionVector}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={1400}
        shadow-camera-left={-450}
        shadow-camera-right={450}
        shadow-camera-top={450}
        shadow-camera-bottom={-450}
        shadow-bias={-0.0005}
        shadow-normalBias={0.6}
      />

      {/* Sky bounce: cool from above, warm ground reflection below. */}
      <hemisphereLight
        color={isNight ? '#4a5f8f' : '#bfe0ff'}
        groundColor={isNight ? '#2a3550' : '#6b7d5a'}
        intensity={isNight ? 0.75 : 0.7}
      />

      {/* Subtle fill from the opposite side so shadowed faces aren't dead black. */}
      <directionalLight
        position={[-sunPositionVector[0], 180, -sunPositionVector[2]]}
        intensity={isNight ? 0.32 : 0.35}
        color={isNight ? '#7d92c4' : '#cfe4ff'}
      />

      {!isNight && weather === 'clear' && (
        <Sky
          distance={45000}
          sunPosition={sunPositionVector}
          inclination={0.5}
          azimuth={0.25}
          turbidity={isGolden ? 8 : 4}
          rayleigh={isGolden ? 3 : 1.2}
        />
      )}

      {isNight && weather === 'clear' && (
        <Stars radius={800} depth={120} count={2500} factor={5} saturation={0} fade speed={0.4} />
      )}

      {/* Street-level sodium glow at night, spread across the map rather than
          concentrated on the centre block. */}
      {isNight && (
        <>
          <pointLight position={[0, 70, 0]} intensity={2.6} color="#ffca6b" distance={700} decay={1.4} />
          <pointLight position={[230, 55, 230]} intensity={1.7} color="#ffb45c" distance={560} decay={1.4} />
          <pointLight position={[-230, 55, -230]} intensity={1.7} color="#ffb45c" distance={560} decay={1.4} />
          <pointLight position={[230, 55, -230]} intensity={1.4} color="#ffbe72" distance={520} decay={1.4} />
          <pointLight position={[-230, 55, 230]} intensity={1.4} color="#ffbe72" distance={520} decay={1.4} />
        </>
      )}
    </>
  );
}
