import { create } from 'zustand';
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

/**
 * Projects are stored in the browser via localRepo.
 *
 * This store previously branched between localRepo and Supabase. The Supabase
 * half was unreachable — the flag guarding it was pinned to local storage — and
 * merely importing the client crashed the deployed build, because it threw on a
 * missing VITE_SUPABASE_URL at module load. The branches are gone; localRepo is
 * the single persistence layer.
 */
export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      set({ projects: await localRepo.listProjects() });
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (project) => {
    // localRepo seeds the project's locations/roads from the template itself.
    const created = await localRepo.createProject(project);
    set((state) => ({ projects: [created, ...state.projects] }));
    return created.id;
  },

  updateProject: async (id, updates) => {
    await localRepo.updateProject(id, updates);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  },

  deleteProject: async (id) => {
    await localRepo.deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },
}));
