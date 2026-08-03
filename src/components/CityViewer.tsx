import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CityScene } from './CityScene';
import { CityControls } from './CityControls';
import { AddMenu } from './AddMenu';
import { LocationInfo } from './LocationInfo';
import { SectorSelector } from '../features/projects/components/SectorSelector';
import { SectorAnalytics } from './SectorAnalytics';
import { LocationComments } from './LocationComments';
import { MiniMap } from './MiniMap';
import { DarkModeToggle } from './DarkModeToggle';
import { MapBackground } from './MapBackground';
import { CameraUIControls } from './CameraUIControls';
import { ArrowLeft, Loader2, Layers, BarChart3, MessageCircle, GitFork } from 'lucide-react';
import { IntersectionPanel } from './IntersectionPanel';
import { IntersectionInfo } from './IntersectionInfo';
import { useProjectStore } from '../store/projectStore';
import { useCityStore } from '../store/cityStore';
import { selectVisibleCity } from '../utils/selectVisibleCity';

export function CityViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, fetchProjects, updateProject } = useProjectStore();
  const {
    locations: userLocations,
    roads: userRoads,
    fetchProjectData,
    loading,
    selectedLocation,
    showGeoMap,
    setActiveSectors
  } = useCityStore();
  const [showSectorPanel, setShowSectorPanel] = useState(false);
  const [showIntersections, setShowIntersections] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsLocationId, setCommentsLocationId] = useState<string | null>(null);

  // Memoize project to prevent unnecessary re-renders
  const project = useMemo(() =>
    projects.find(p => p.id === id),
    [projects, id]);

  // Memoize active sectors based on project id and sectors
  const activeSectors = useMemo(() =>
    project?.sectors || [],
    [project?.sectors]);

  // Initial data fetching
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Refetch when the sector selection changes too: newly activated sectors need
  // their template buildings materialised into storage before they can render.
  useEffect(() => {
    if (id && project) {
      fetchProjectData(id, project.model_type, project.sectors || []);
    }
  }, [id, project, fetchProjectData]);

  // Mirror the viewer's sector selection into the store so newly placed
  // buildings can adopt a zone that's actually visible.
  useEffect(() => {
    setActiveSectors(activeSectors);
  }, [activeSectors, setActiveSectors]);

  /*
    Storage is the single source of truth for what's in the city. Template
    buildings for the active sectors are materialised into storage on load
    (see localRepo.ensureSectorLocations), so this view no longer merges the
    static template in on top — doing both drew every seeded building twice and
    left the on-screen ids unmatched by anything in the store, which is why
    route drawing had nothing to connect to.
  */
  const { combinedLocations, combinedRoads } = useMemo(() => {
    if (!project || !userLocations || !userRoads) {
      return { combinedLocations: [], combinedRoads: [] };
    }

    const visible = selectVisibleCity(userLocations, userRoads, activeSectors);
    return { combinedLocations: visible.locations, combinedRoads: visible.roads };
  }, [project, userLocations, userRoads, activeSectors]);

  if (!project || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  const handleSectorChange = async (sectors: string[]) => {
    if (project) {
      await updateProject(project.id, {
        sectors,
        updated_at: new Date().toISOString()
      });
    }
  };

  const handleLocationComments = (locationId: string) => {
    setCommentsLocationId(locationId);
    setShowComments(true);
  };

  return (
    <div id="city-viewer-container" className="flex h-screen w-full flex-col bg-slate-100 dark:bg-slate-950">
      <header className="z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn-ghost !px-2.5"
              aria-label="Back to projects"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight text-slate-900 dark:text-white">
                {project.name}
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
                {project.model_type === 'planning' ? 'City Planning' : 'Corporate Campus'}
                <span className="text-slate-300 dark:text-slate-600">·</span>
                {combinedLocations.length} buildings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`btn-ghost ${showAnalytics ? 'btn-ghost-active' : ''}`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            {selectedLocation && (
              <button
                onClick={() => handleLocationComments(selectedLocation.id)}
                className="btn-ghost"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Comments</span>
              </button>
            )}
            <button
              onClick={() => { setShowIntersections(!showIntersections); setShowSectorPanel(false); }}
              className={`btn-ghost ${showIntersections ? 'btn-ghost-active' : ''}`}
            >
              <GitFork className="h-4 w-4" />
              <span className="hidden sm:inline">Intersections</span>
            </button>
            <button
              onClick={() => { setShowSectorPanel(!showSectorPanel); setShowIntersections(false); }}
              className={`btn-ghost ${showSectorPanel ? 'btn-ghost-active' : ''}`}
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Sectors</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex-grow">
        {showAnalytics ? (
          <div className="h-full overflow-y-auto bg-slate-100 p-6 dark:bg-slate-950">
            <div className="mx-auto max-w-7xl">
              <div className="mb-6">
                <h2 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Project analytics
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Sector performance, usage patterns and city metrics
                </p>
              </div>
              <SectorAnalytics
                locations={combinedLocations}
                roads={combinedRoads}
                activeSectors={activeSectors}
                modelType={project.model_type}
              />
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {showGeoMap && <MapBackground />}
            {/* The canvas sits directly in the stack; the old pointer-events
                none/auto wrapper pair cancelled each other out. */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <CityScene locations={combinedLocations} roads={combinedRoads} />
            </div>
            <CameraUIControls />
            <CityControls />
            <AddMenu />
            <LocationInfo />
            <IntersectionInfo />
            <MiniMap
              locations={combinedLocations}
              roads={combinedRoads}
              viewPosition={[0, 20, 0]}
            />
          </div>
        )}

        {showIntersections && !showAnalytics && (
          <IntersectionPanel onClose={() => setShowIntersections(false)} />
        )}

        {showSectorPanel && (
          <div className="panel absolute right-4 top-4 z-20 w-80 p-4">
            <h3 className="panel-heading mb-3">Active sectors</h3>
            <SectorSelector
              modelType={project.model_type}
              selectedSectors={activeSectors}
              onChange={handleSectorChange}
              compact
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              New buildings you place adopt the first active sector.
            </p>
          </div>
        )}
      </div>

      {/* Comments Modal */}
      {showComments && commentsLocationId && selectedLocation && (
        <LocationComments
          locationId={commentsLocationId}
          locationName={selectedLocation.name}
          onClose={() => {
            setShowComments(false);
            setCommentsLocationId(null);
          }}
        />
      )}
    </div>
  );
}