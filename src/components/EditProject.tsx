import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { ProjectForm } from '../features/projects/ProjectForm';

export function EditProject() {
  const { id } = useParams();
  const { projects, fetchProjects } = useProjectStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false));
  }, [fetchProjects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  const project = projects.find(p => p.id === id);
  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-gray-600 dark:text-gray-300">Project not found</div>
      </div>
    );
  }

  return (
    <ProjectForm
      mode="edit"
      initialData={{
        id: project.id,
        name: project.name,
        description: project.description || '',
        model_type: project.model_type,
        sectors: project.sectors || [],
        theme: project.theme || 'default',
        center_lat: project.center_lat,
        center_lng: project.center_lng,
        zoom: project.zoom
      }}
    />
  );
}