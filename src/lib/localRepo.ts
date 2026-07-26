/**
 * localStorage-backed stand-in for the Supabase tables, used when DEMO_MODE is
 * on. Mirrors just the shapes the stores actually read/write: projects,
 * locations and roads, each keyed by project id.
 *
 * Everything is synchronous under the hood but exposed as promises so the store
 * call sites are identical to the Supabase ones.
 */
import { Location, Road } from '../types/city';
import { cityPlanningData } from '../data/cityPlanningData';
import { corporateCampusData } from '../data/corporateCampusData';
import { DEMO_USER_ID } from './demoMode';

const STORAGE_KEY = 'city3d.demo.v1';

export interface StoredProject {
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

interface DemoDatabase {
  projects: StoredProject[];
  locations: Record<string, Location[]>;
  roads: Record<string, Road[]>;
  /**
   * Sectors already seeded from the template, per project.
   *
   * Without this, "seed anything missing" would resurrect buildings the user
   * deleted the next time the project was opened.
   */
  seededSectors: Record<string, string[]>;
}

const emptyDb = (): DemoDatabase => ({
  projects: [],
  locations: {},
  roads: {},
  seededSectors: {}
});

function read(): DemoDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<DemoDatabase>;
    return {
      projects: parsed.projects ?? [],
      locations: parsed.locations ?? {},
      roads: parsed.roads ?? {},
      seededSectors: parsed.seededSectors ?? {}
    };
  } catch {
    // Corrupted or unavailable storage shouldn't hard-fail the app.
    return emptyDb();
  }
}

function write(db: DemoDatabase) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Quota or private-mode failures are non-fatal; state stays in memory.
  }
}

const newId = () =>
  (crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Seeds a project's locations/roads from the matching template, filtered to the
 * sectors the user picked — same rule the Supabase createProject path uses.
 */
function seedFromTemplate(project: StoredProject) {
  const template =
    project.model_type === 'planning' ? cityPlanningData : corporateCampusData;
  const sectors = project.sectors ?? [];

  const locations = template.locations
    .filter(loc => sectors.includes(loc.zone || ''))
    .map(loc => ({ ...loc, id: newId(), templateId: loc.id }));

  const idByTemplateId = new Map(
    locations.map(loc => [(loc as { templateId: string }).templateId, loc.id])
  );

  const roads = template.roads
    .filter(road => idByTemplateId.has(road.from) && idByTemplateId.has(road.to))
    .map(road => ({
      ...road,
      id: newId(),
      from: idByTemplateId.get(road.from)!,
      to: idByTemplateId.get(road.to)!
    }));

  // Drop the temporary templateId before storing.
  const cleanedLocations: Location[] = locations.map(({ ...loc }) => {
    delete (loc as { templateId?: string }).templateId;
    return loc as Location;
  });

  return { locations: cleanedLocations, roads };
}

export const localRepo = {
  async listProjects(): Promise<StoredProject[]> {
    const db = read();
    return [...db.projects].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async createProject(
    input: Omit<StoredProject, 'id' | 'created_at'>
  ): Promise<StoredProject> {
    const db = read();
    const project: StoredProject = {
      ...input,
      user_id: input.user_id ?? DEMO_USER_ID,
      id: newId(),
      created_at: new Date().toISOString()
    };

    const seeded = seedFromTemplate(project);
    db.projects.unshift(project);
    db.locations[project.id] = seeded.locations;
    db.roads[project.id] = seeded.roads;
    // These sectors are now seeded; don't re-add their template buildings later.
    db.seededSectors[project.id] = [...(project.sectors ?? [])];
    write(db);
    return project;
  },

  async updateProject(id: string, updates: Partial<StoredProject>): Promise<void> {
    const db = read();
    db.projects = db.projects.map(p => (p.id === id ? { ...p, ...updates } : p));
    write(db);
  },

  async deleteProject(id: string): Promise<void> {
    const db = read();
    db.projects = db.projects.filter(p => p.id !== id);
    delete db.locations[id];
    delete db.roads[id];
    delete db.seededSectors[id];
    write(db);
  },

  async getCityData(projectId: string): Promise<{ locations: Location[]; roads: Road[] }> {
    const db = read();
    return {
      locations: db.locations[projectId] ?? [],
      roads: db.roads[projectId] ?? []
    };
  },

  /**
   * Seed a sector's template buildings into storage the first time that sector
   * becomes active.
   *
   * Storage is the single source of truth for what's in a city. The viewer used
   * to merge the static template in at render time on top of the seeded copies,
   * which meant every template building existed twice (once as static data with
   * a template id, once as a stored row with a real id). Route drawing then had
   * nothing to attach to, because the ids on screen weren't in the store.
   *
   * Seeding is tracked per sector rather than "add whatever is missing",
   * because the latter silently resurrects buildings the user has deleted.
   */
  async ensureSectorLocations(
    projectId: string,
    modelType: 'planning' | 'corporate',
    sectors: string[]
  ): Promise<{ locations: Location[]; roads: Road[] }> {
    const db = read();
    const existing = db.locations[projectId] ?? [];
    const template = modelType === 'planning' ? cityPlanningData : corporateCampusData;

    const alreadySeeded = db.seededSectors[projectId] ?? [];
    const sectorsToSeed = sectors.filter(s => !alreadySeeded.includes(s));

    if (sectorsToSeed.length === 0) {
      return { locations: existing, roads: db.roads[projectId] ?? [] };
    }

    const signature = (name: string, pos: number[]) => `${name}@${pos[0]},${pos[2]}`;
    const present = new Set(existing.map(l => signature(l.name, l.position)));

    const missing = template.locations.filter(
      loc =>
        sectorsToSeed.includes(loc.zone || '') &&
        !present.has(signature(loc.name, loc.position))
    );

    // Record the seed attempt even when nothing was added, so we don't retry.
    db.seededSectors[projectId] = [...new Set([...alreadySeeded, ...sectors])];

    if (missing.length === 0) {
      write(db);
      return { locations: existing, roads: db.roads[projectId] ?? [] };
    }

    // Map template id -> new stored id so template roads can be seeded too.
    const idByTemplateId = new Map<string, string>();
    const created: Location[] = missing.map(loc => {
      const id = newId();
      idByTemplateId.set(loc.id, id);
      return { ...loc, id };
    });

    // Include already-stored buildings in the map so a road between a new
    // building and a previously seeded one still resolves.
    existing.forEach(l => {
      const match = template.locations.find(
        t => signature(t.name, t.position) === signature(l.name, l.position)
      );
      if (match) idByTemplateId.set(match.id, l.id);
    });

    const nextLocations = [...existing, ...created];
    const existingRoads = db.roads[projectId] ?? [];
    const roadKey = (a: string, b: string) => [a, b].sort().join('~');
    const haveRoad = new Set(existingRoads.map(r => roadKey(r.from, r.to)));

    const newRoads: Road[] = template.roads
      .filter(r => idByTemplateId.has(r.from) && idByTemplateId.has(r.to))
      .map(r => ({
        ...r,
        id: newId(),
        from: idByTemplateId.get(r.from)!,
        to: idByTemplateId.get(r.to)!
      }))
      .filter(r => !haveRoad.has(roadKey(r.from, r.to)));

    db.locations[projectId] = nextLocations;
    db.roads[projectId] = [...existingRoads, ...newRoads];
    write(db);

    return { locations: nextLocations, roads: db.roads[projectId] };
  },

  async addLocation(projectId: string, location: Omit<Location, 'id'>): Promise<Location> {
    const db = read();
    const created: Location = { ...location, id: newId() };
    db.locations[projectId] = [...(db.locations[projectId] ?? []), created];
    write(db);
    return created;
  },

  async addRoad(projectId: string, road: Omit<Road, 'id'>): Promise<Road> {
    const db = read();
    const created: Road = { ...road, id: newId() };
    db.roads[projectId] = [...(db.roads[projectId] ?? []), created];
    write(db);
    return created;
  },

  async updateLocation(
    projectId: string,
    locationId: string,
    patch: Partial<Location>
  ): Promise<void> {
    const db = read();
    db.locations[projectId] = (db.locations[projectId] ?? []).map(l =>
      l.id === locationId ? { ...l, ...patch } : l
    );
    write(db);
  },

  async deleteLocation(projectId: string, locationId: string): Promise<void> {
    const db = read();
    db.locations[projectId] = (db.locations[projectId] ?? []).filter(
      l => l.id !== locationId
    );
    // Roads referencing the removed location would dangle.
    db.roads[projectId] = (db.roads[projectId] ?? []).filter(
      r => r.from !== locationId && r.to !== locationId
    );
    write(db);
  }
};
