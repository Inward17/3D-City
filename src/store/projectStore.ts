import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { cityPlanningData } from '../data/cityPlanningData';
import { corporateCampusData } from '../data/corporateCampusData';
import { DEMO_MODE } from '../lib/demoMode';
import { localRepo } from '../lib/localRepo';

export interface Project {
  id: string;
  user_id?: string;
  name: string;
  description: string;
  model_type: 'planning' | 'corporate';
  sectors?: string[];
  theme?: string;
  center_lat?: number;
  center_lng?: number;
  zoom?: number;
  created_at: string;
  updated_at?: string;
}

interface ProjectState {
  projects: Project[];
  loading: boolean;
  fetchProjects: () => Promise<void>;
  createProject: (project: Omit<Project, 'id' | 'created_at'>) => Promise<string>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      if (DEMO_MODE) {
        set({ projects: await localRepo.listProjects() });
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ projects: data || [] });
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (project) => {
    if (DEMO_MODE) {
      // localRepo seeds locations/roads from the template itself.
      const created = await localRepo.createProject(project);
      set((state) => ({ projects: [created, ...state.projects] }));
      return created.id;
    }

    // Start a Supabase transaction
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single();

    if (projectError) throw projectError;

    // Get the template data based on project type
    const templateData = project.model_type === 'planning'
      ? cityPlanningData
      : corporateCampusData;

    // Filter locations based on selected sectors
    const filteredLocations = templateData.locations.filter(
      loc => project.sectors?.includes(loc.zone || '')
    );

    // Insert locations
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .insert(
        filteredLocations.map(location => ({
          project_id: newProject.id,
          name: location.name,
          type: location.type,
          position: location.position,
          description: location.description,
          color: location.color,
          zone: location.zone
        }))
      )
      .select();

    if (locationsError) throw locationsError;

    // Create a map of old to new location IDs
    const locationIdMap = new Map(
      locations.map((newLoc, index) => [filteredLocations[index].id, newLoc.id])
    );

    // Filter and transform roads
    const filteredRoads = templateData.roads.filter(road =>
      locationIdMap.has(road.from) && locationIdMap.has(road.to)
    );

    // Insert roads with new location IDs
    const { error: roadsError } = await supabase
      .from('roads')
      .insert(
        filteredRoads.map(road => ({
          project_id: newProject.id,
          from_location: locationIdMap.get(road.from),
          to_location: locationIdMap.get(road.to),
          distance: road.distance,
          type: road.type
        }))
      );

    if (roadsError) throw roadsError;

    set((state) => ({ projects: [newProject, ...state.projects] }));
    return newProject.id;
  },

  updateProject: async (id, updates) => {
    if (DEMO_MODE) {
      await localRepo.updateProject(id, updates);
    } else {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    }
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  },

  deleteProject: async (id) => {
    if (DEMO_MODE) {
      await localRepo.deleteProject(id);
    } else {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },
}));