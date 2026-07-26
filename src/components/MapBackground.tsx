import { useState, useEffect } from 'react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCityStore } from '../store/cityStore';
import { useProjectStore } from '../store/projectStore';

// Get Project type from local store definitions
type Project = ReturnType<typeof useProjectStore.getState>['projects'][0];

export function MapBackground({ project }: { project?: Project }) {
    const { cameraState } = useCityStore();

    // Center reference: Project or fallback to Pune
    const CENTER_LNG = project?.center_lng || 73.8567;
    const CENTER_LAT = project?.center_lat || 18.5204;

    const METERS_PER_DEGREE_LAT = 111320;
    const METERS_PER_DEGREE_LNG = 111320 * Math.cos(CENTER_LAT * (Math.PI / 180));
    const [viewState, setViewState] = useState({
        longitude: CENTER_LNG,
        latitude: CENTER_LAT,
        zoom: project?.zoom || 15,
        pitch: 45,
        bearing: 0
    });

    useEffect(() => {
        let frameId: number;

        const syncMap = () => {
            // Continuously sync ThreeJS OrbitControls to MapLibre ViewState
            if (cameraState.camera && cameraState.controls) {
                const cam = cameraState.camera;
                const target = cameraState.controls.target;

                // 1. Calculate Pitch (tilt)
                const dx = cam.position.x - target.x;
                const dz = cam.position.z - target.z;
                const horizontalDist = Math.sqrt(dx * dx + dz * dz);
                const verticalDist = cam.position.y - target.y;

                // Pitch in degrees (0 is looking straight down, 90 is looking at horizon)
                let pitch = Math.atan2(horizontalDist, verticalDist) * (180 / Math.PI);
                // MapLibre caps pitch at around 85 degrees
                pitch = Math.max(0, Math.min(85, pitch));

                // 2. Calculate Bearing (rotation)
                // Mapbox bearing is 0 degrees at North, increasing clockwise.
                // In our ThreeJS scene, North is usually -Z.
                const bearing = Math.atan2(-dx, -dz) * (180 / Math.PI);

                // 3. Calculate Target Coordinates
                // Map ThreeJS X to Longitude and Z to Latitude
                const lng = CENTER_LNG + (target.x / METERS_PER_DEGREE_LNG);
                const lat = CENTER_LAT - (target.z / METERS_PER_DEGREE_LAT);

                // 4. Calculate Zoom
                // Distance from camera to target dictates zoom level
                const distance = cam.position.distanceTo(target);
                // Calibrate MapLibre Zoom scale to ThreeJS distance.
                // Adjusted for 10x geometry scaling
                const baseZoom = 22.5;
                const zoom = Math.max(0, baseZoom - Math.log2(distance || 1));

                setViewState({
                    longitude: lng,
                    latitude: lat,
                    zoom: zoom,
                    pitch: pitch,
                    bearing: bearing
                });
            }

            frameId = requestAnimationFrame(syncMap);
        };

        syncMap();
        return () => cancelAnimationFrame(frameId);
    }, [cameraState, CENTER_LAT, CENTER_LNG, METERS_PER_DEGREE_LAT, METERS_PER_DEGREE_LNG]);

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
            <Map
                {...viewState}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                interactive={false}
            />
        </div>
    );
}
