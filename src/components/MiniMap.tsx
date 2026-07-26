import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Compass, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Location, Road } from '../types/city';
import { useCityStore } from '../store/cityStore';

/**
 * Tracks the `dark` class on <html>. useDarkMode() keeps its state locally per
 * call site, so calling it here would spin up a second, independent copy that
 * fights the toggle over localStorage — observing the class is the honest read.
 */
function useIsDarkClass(): boolean {
  const [isDark, setIsDark] = React.useState(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() =>
      setIsDark(el.classList.contains('dark'))
    );
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

interface MiniMapProps {
  locations: Location[];
  roads: Road[];
  viewPosition?: [number, number, number];
}

const CANVAS_W = 208;
const CANVAS_H = 156;

export function MiniMap({ locations, roads, viewPosition = [0, 0, 0] }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const isDarkMode = useIsDarkClass();
  const { flyToCameraLocation, selectedLocation } = useCityStore();

  /** Square bounds keep the aspect ratio honest instead of stretching the city. */
  const bounds = useMemo(() => {
    if (locations.length === 0) {
      return { minX: -300, maxX: 300, minZ: -300, maxZ: 300 };
    }
    const xs = locations.map(l => l.position[0]);
    const zs = locations.map(l => l.position[2]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const half = Math.max(
      60,
      (Math.max(...xs) - Math.min(...xs)) / 2,
      (Math.max(...zs) - Math.min(...zs)) / 2
    ) * 1.15;
    return { minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half };
  }, [locations]);

  const worldToCanvas = useCallback(
    (x: number, z: number): [number, number] => {
      const { minX, maxX, minZ, maxZ } = bounds;
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      const nx = ((x - minX) / (maxX - minX) - 0.5) * CANVAS_W * zoom;
      const nz = ((z - minZ) / (maxZ - minZ) - 0.5) * CANVAS_H * zoom;
      return [cx + nx, cy + nz];
    },
    [bounds, zoom]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render at device pixel ratio; the old version drew at CSS size and looked
    // soft on any HiDPI screen.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = isDarkMode ? '#0b1220' : '#e8eef4';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    ctx.strokeStyle = isDarkMode ? 'rgba(148,163,184,0.10)' : 'rgba(15,23,42,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const x = (CANVAS_W / 6) * i;
      const y = (CANVAS_H / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H);
      ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    // Roads
    ctx.strokeStyle = isDarkMode ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.45)';
    ctx.lineCap = 'round';
    roads.forEach(road => {
      const from = locations.find(l => l.id === road.from);
      const to = locations.find(l => l.id === road.to);
      if (!from || !to) return;
      ctx.lineWidth = road.type === 'main' ? 2.5 : road.type === 'secondary' ? 1.8 : 1.1;
      const [fx, fz] = worldToCanvas(from.position[0], from.position[2]);
      const [tx, tz] = worldToCanvas(to.position[0], to.position[2]);
      ctx.beginPath();
      ctx.moveTo(fx, fz);
      ctx.lineTo(tx, tz);
      ctx.stroke();
    });

    // Locations
    locations.forEach(location => {
      const [x, z] = worldToCanvas(location.position[0], location.position[2]);
      const isSel = selectedLocation?.id === location.id;
      ctx.fillStyle = location.color || '#60a5fa';

      if (location.type === 'Park') {
        ctx.beginPath();
        ctx.arc(x, z, isSel ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const s = isSel ? 7 : 5;
        ctx.fillRect(x - s / 2, z - s / 2, s, s);
      }

      if (isSel) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, z, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Camera position marker
    const [vx, vz] = worldToCanvas(viewPosition[0], viewPosition[2]);
    ctx.strokeStyle = '#f43f5e';
    ctx.fillStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vx - 6, vz); ctx.lineTo(vx + 6, vz);
    ctx.moveTo(vx, vz - 6); ctx.lineTo(vx, vz + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(vx, vz, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }, [locations, roads, zoom, viewPosition, worldToCanvas, isDarkMode, selectedLocation]);

  /** Click to fly the camera there — previously this prop was never supplied. */
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    const { minX, maxX, minZ, maxZ } = bounds;
    const nx = (px - CANVAS_W / 2) / (CANVAS_W * zoom) + 0.5;
    const nz = (py - CANVAS_H / 2) / (CANVAS_H * zoom) + 0.5;
    const worldX = nx * (maxX - minX) + minX;
    const worldZ = nz * (maxZ - minZ) + minZ;

    flyToCameraLocation([worldX, 0, worldZ]);
  };

  return (
    <div className="panel absolute bottom-4 right-4 z-10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="panel-heading flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5" />
          Mini map
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(3, z * 1.25))}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            title="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, z / 1.25))}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            title="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
            title="Reset zoom"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: CANVAS_W, height: CANVAS_H }}
          className="cursor-crosshair rounded-lg ring-1 ring-slate-900/10 dark:ring-white/10"
          onClick={handleCanvasClick}
          title="Click to fly the camera here"
        />
        <div className="pointer-events-none absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/85 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-slate-800/85 dark:text-slate-200">
          N
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px] bg-sky-400" /> Buildings
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Parks
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> Camera
        </span>
      </div>
    </div>
  );
}
