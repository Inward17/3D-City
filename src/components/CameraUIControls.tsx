import { Move3D, Eye, Plane, Film, RotateCcw } from 'lucide-react';
import { useCityStore } from '../store/cityStore';
import type { CameraPreset } from '../store/cityStore';

const presets: { id: CameraPreset; label: string; icon: typeof Move3D }[] = [
  { id: 'isometric', label: 'Isometric', icon: Move3D },
  { id: 'aerial', label: 'Aerial', icon: Plane },
  { id: 'walkthrough', label: 'Walk', icon: Eye },
  { id: 'cinematic', label: 'Cinematic', icon: Film },
  { id: 'free', label: 'Free', icon: RotateCcw }
];

export function CameraUIControls() {
  const { cameraState, animateToPreset } = useCityStore();
  const isTransitioning = cameraState.isAnimating;

  return (
    <div className="panel absolute bottom-4 left-1/2 z-10 -translate-x-1/2 p-1.5">
      <div className="flex items-center gap-1">
        {presets.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => animateToPreset(id)}
            disabled={isTransitioning}
            className={`segment-item disabled:cursor-not-allowed disabled:opacity-60 ${
              cameraState.preset === id ? 'segment-item-active' : ''
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
