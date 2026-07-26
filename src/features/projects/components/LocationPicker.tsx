import { useState } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';

interface LocationPickerProps {
    lat: number;
    lng: number;
    zoom: number;
    onChange: (lat: number, lng: number, zoom: number) => void;
}

export function LocationPicker({ lat, lng, zoom, onChange }: LocationPickerProps) {
    const [viewState, setViewState] = useState({
        longitude: lng,
        latitude: lat,
        zoom: zoom
    });

    return (
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden h-64 bg-gray-100 dark:bg-gray-800">
            <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                onClick={(evt) => onChange(evt.lngLat.lat, evt.lngLat.lng, viewState.zoom)}
                onZoomEnd={(evt) => onChange(viewState.latitude, viewState.longitude, evt.viewState.zoom)}
                mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
                cursor="crosshair"
            >
                <NavigationControl position="bottom-right" />
                <Marker longitude={lng} latitude={lat} anchor="bottom">
                    <MapPin className="text-blue-500 w-8 h-8 fill-current drop-shadow-md" />
                </Marker>
            </Map>
        </div>
    );
}
