import { useMemo, useState, useEffect } from 'react';
import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCityStore } from '../../store/cityStore';
import { Location } from '../../types/city';
import * as THREE from 'three';

interface RoutePreviewProps {
  locations: Location[];
}

/**
 * Rubber-band line from the picked start building to the pointer while a route
 * is being drawn, so it's obvious a first endpoint was registered and where the
 * road will land.
 */
export function RoutePreview({ locations }: RoutePreviewProps) {
  const { isPlacingRoute, routeStartId, roadTypeToPlace } = useCityStore();
  const { camera, gl } = useThree();
  const [cursor, setCursor] = useState<THREE.Vector3 | null>(null);

  const start = useMemo(
    () => locations.find(l => l.id === routeStartId) ?? null,
    [locations, routeStartId]
  );

  useEffect(() => {
    if (!isPlacingRoute || !start) {
      setCursor(null);
      return;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    // Road height matches RoadsLayer so the preview sits on the same plane.
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
    const hit = new THREE.Vector3();
    const el = gl.domElement;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(ground, hit)) {
        setCursor(hit.clone());
      }
    };

    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [isPlacingRoute, start, camera, gl]);

  if (!isPlacingRoute || !start || !cursor) return null;

  const color =
    roadTypeToPlace === 'main' ? '#38bdf8'
      : roadTypeToPlace === 'secondary' ? '#34d399'
        : '#fbbf24';

  return (
    <Line
      points={[
        new THREE.Vector3(start.position[0], 1.2, start.position[2]),
        cursor
      ]}
      color={color}
      lineWidth={2}
      dashed
      dashScale={6}
      dashSize={4}
      gapSize={2}
      transparent
      opacity={0.9}
    />
  );
}
