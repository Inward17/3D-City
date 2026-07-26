import { describe, it, expect, beforeEach } from 'vitest';
import { localRepo } from './localRepo';
import { cityPlanningData } from '../data/cityPlanningData';

const STORAGE_KEY = 'city3d.demo.v1';

const readDb = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

const templateNamesFor = (sectors: string[]) =>
  cityPlanningData.locations
    .filter(l => sectors.includes(l.zone || ''))
    .map(l => l.name)
    .sort();

async function makeProject(sectors: string[]) {
  return localRepo.createProject({
    name: 'Test project',
    description: '',
    model_type: 'planning',
    sectors,
    theme: 'default'
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('createProject', () => {
  it('seeds the template buildings for the chosen sectors', async () => {
    const project = await makeProject(['commercial']);
    const { locations } = await localRepo.getCityData(project.id);

    expect(locations.map(l => l.name).sort()).toEqual(templateNamesFor(['commercial']));
    expect(locations.every(l => l.id && l.id.length > 0)).toBe(true);
  });

  it('gives every seeded building a fresh id, not the template id', async () => {
    const project = await makeProject(['commercial']);
    const { locations } = await localRepo.getCityData(project.id);
    const templateIds = new Set(cityPlanningData.locations.map(l => l.id));

    // Route drawing needs stable stored ids; template ids exist only in the
    // static data and would not resolve.
    for (const loc of locations) {
      expect(templateIds.has(loc.id)).toBe(false);
    }
  });

  it('rewrites seeded roads to point at the new location ids', async () => {
    const project = await makeProject(['commercial']);
    const { locations, roads } = await localRepo.getCityData(project.id);
    const ids = new Set(locations.map(l => l.id));

    for (const road of roads) {
      expect(ids.has(road.from)).toBe(true);
      expect(ids.has(road.to)).toBe(true);
    }
  });

  it('records the chosen sectors as already seeded', async () => {
    const project = await makeProject(['commercial', 'healthcare']);
    expect(readDb().seededSectors[project.id].sort()).toEqual(['commercial', 'healthcare']);
  });

  it('does not leak locations between projects', async () => {
    const a = await makeProject(['commercial']);
    const b = await makeProject(['healthcare']);

    const aData = await localRepo.getCityData(a.id);
    const bData = await localRepo.getCityData(b.id);

    expect(aData.locations.map(l => l.name).sort()).toEqual(templateNamesFor(['commercial']));
    expect(bData.locations.map(l => l.name).sort()).toEqual(templateNamesFor(['healthcare']));
  });
});

describe('ensureSectorLocations', () => {
  it('is a no-op for sectors that were already seeded', async () => {
    const project = await makeProject(['commercial']);
    const before = await localRepo.getCityData(project.id);

    const after = await localRepo.ensureSectorLocations(project.id, 'planning', ['commercial']);

    expect(after.locations).toHaveLength(before.locations.length);
    expect(after.locations.map(l => l.id).sort()).toEqual(before.locations.map(l => l.id).sort());
  });

  it('seeds a sector that is activated after creation', async () => {
    const project = await makeProject(['commercial']);
    const before = await localRepo.getCityData(project.id);

    const after = await localRepo.ensureSectorLocations(
      project.id,
      'planning',
      ['commercial', 'residential']
    );

    expect(after.locations.length).toBeGreaterThan(before.locations.length);
    expect(after.locations.map(l => l.name).sort())
      .toEqual(templateNamesFor(['commercial', 'residential']));
    expect(readDb().seededSectors[project.id].sort())
      .toEqual(['commercial', 'residential']);
  });

  it('does not resurrect a deleted building on reload', async () => {
    // This is the regression: seeding "anything missing" silently re-added
    // buildings the user had deleted every time the project was reopened.
    const project = await makeProject(['commercial']);
    const { locations } = await localRepo.getCityData(project.id);
    const victim = locations[0];

    await localRepo.deleteLocation(project.id, victim.id);

    const reloaded = await localRepo.ensureSectorLocations(
      project.id,
      'planning',
      ['commercial']
    );

    expect(reloaded.locations.map(l => l.id)).not.toContain(victim.id);
    expect(reloaded.locations.map(l => l.name)).not.toContain(victim.name);
    expect(reloaded.locations).toHaveLength(locations.length - 1);
  });

  it('still keeps a deleted building gone when a new sector is added later', async () => {
    const project = await makeProject(['commercial']);
    const { locations } = await localRepo.getCityData(project.id);
    const victim = locations[0];
    await localRepo.deleteLocation(project.id, victim.id);

    const after = await localRepo.ensureSectorLocations(
      project.id,
      'planning',
      ['commercial', 'healthcare']
    );

    expect(after.locations.map(l => l.name)).not.toContain(victim.name);
    // ...but the newly activated sector did arrive.
    expect(after.locations.map(l => l.name))
      .toEqual(expect.arrayContaining(templateNamesFor(['healthcare'])));
  });

  it('does not duplicate roads when re-run', async () => {
    const project = await makeProject(['commercial']);
    const first = await localRepo.ensureSectorLocations(project.id, 'planning', ['commercial']);
    const second = await localRepo.ensureSectorLocations(project.id, 'planning', ['commercial']);

    expect(second.roads).toHaveLength(first.roads.length);
  });
});

describe('addLocation / addRoad', () => {
  it('assigns an id and persists the location', async () => {
    const project = await makeProject(['commercial']);
    const created = await localRepo.addLocation(project.id, {
      name: 'New Hotel',
      type: 'Hotel',
      position: [10, 0, 20],
      description: '',
      color: '#38bdf8',
      zone: 'commercial'
    });

    expect(created.id).toBeTruthy();
    const { locations } = await localRepo.getCityData(project.id);
    expect(locations.map(l => l.id)).toContain(created.id);
  });

  it('persists a road between two buildings', async () => {
    const project = await makeProject(['commercial']);
    const { locations } = await localRepo.getCityData(project.id);

    const created = await localRepo.addRoad(project.id, {
      from: locations[0].id,
      to: locations[1].id,
      distance: 424,
      type: 'main'
    });

    const { roads } = await localRepo.getCityData(project.id);
    expect(roads.map(r => r.id)).toContain(created.id);
    expect(roads.find(r => r.id === created.id)?.distance).toBe(424);
  });
});

describe('deleteLocation', () => {
  it('removes roads that referenced the deleted building', async () => {
    const project = await makeProject(['commercial']);
    const { locations } = await localRepo.getCityData(project.id);
    const [a, b] = locations;
    await localRepo.addRoad(project.id, { from: a.id, to: b.id, distance: 10, type: 'main' });

    await localRepo.deleteLocation(project.id, a.id);

    const { locations: after, roads } = await localRepo.getCityData(project.id);
    expect(after.map(l => l.id)).not.toContain(a.id);
    // No road may reference a building that is gone.
    const ids = new Set(after.map(l => l.id));
    for (const road of roads) {
      expect(ids.has(road.from) && ids.has(road.to)).toBe(true);
    }
  });
});

describe('deleteProject', () => {
  it('clears the project data and its seeding record', async () => {
    const project = await makeProject(['commercial']);
    await localRepo.deleteProject(project.id);

    const db = readDb();
    expect(db.projects.find((p: { id: string }) => p.id === project.id)).toBeUndefined();
    expect(db.locations[project.id]).toBeUndefined();
    expect(db.roads[project.id]).toBeUndefined();
    expect(db.seededSectors[project.id]).toBeUndefined();
  });
});

describe('storage resilience', () => {
  it('recovers from corrupted storage instead of throwing', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    await expect(localRepo.listProjects()).resolves.toEqual([]);
  });

  it('tolerates a database written by an older version with no seededSectors', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projects: [], locations: {}, roads: {} })
    );
    await expect(
      localRepo.ensureSectorLocations('missing-project', 'planning', ['commercial'])
    ).resolves.toBeTruthy();
  });
});
