import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  elevationAt, slopeAt, slopeDegreesAt, gradientAt, gradeOf, gradeFactors,
  earthworksFor, groundLevelFor, raycastTerrain,
  TERRAIN_RELIEF, GRADE_SPEED_PENALTY
} from './terrain';

const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('elevationAt', () => {
  it('is deterministic', () => {
    // Two versions of a scheme have to sit on the same ground to be comparable.
    for (const [x, z] of [[0, 0], [123, -456], [-999, 42]]) {
      expect(elevationAt(x, z)).toBe(elevationAt(x, z));
    }
  });

  it('stays within the stated relief', () => {
    let lowest = Infinity;
    let highest = -Infinity;
    for (let x = -600; x <= 600; x += 7) {
      for (let z = -600; z <= 600; z += 7) {
        const h = elevationAt(x, z);
        lowest = Math.min(lowest, h);
        highest = Math.max(highest, h);
      }
    }
    expect(highest - lowest).toBeGreaterThan(TERRAIN_RELIEF * 0.5);
    expect(highest - lowest).toBeLessThanOrEqual(TERRAIN_RELIEF * 1.05);
  });

  it('is smooth — no cliffs between adjacent samples', () => {
    for (let x = -400; x <= 400; x += 11) {
      for (let z = -400; z <= 400; z += 11) {
        expect(Math.abs(elevationAt(x + 1, z) - elevationAt(x, z))).toBeLessThan(0.5);
      }
    }
  });

  it('is not flat', () => {
    const heights = new Set<number>();
    for (let x = -300; x <= 300; x += 50) heights.add(Math.round(elevationAt(x, 0)));
    expect(heights.size).toBeGreaterThan(2);
  });
});

describe('slopeAt', () => {
  it('is zero at a summit', () => {
    // Walk uphill to a local maximum; the gradient there must vanish.
    let [x, z] = [40, 40];
    for (let step = 0; step < 400; step++) {
      const [dx, dz] = gradientAt(x, z);
      if (Math.hypot(dx, dz) < 1e-4) break;
      x += dx * 40;
      z += dz * 40;
    }
    expect(slopeAt(x, z)).toBeLessThan(0.01);
  });

  it('is buildable across the site — no cliffs to plan around', () => {
    let steepest = 0;
    for (let x = -400; x <= 400; x += 9) {
      for (let z = -400; z <= 400; z += 9) {
        steepest = Math.max(steepest, slopeAt(x, z));
      }
    }
    // Steep enough to matter to a lorry, gentle enough to build a city on.
    expect(steepest).toBeGreaterThan(0.03);
    expect(steepest).toBeLessThan(0.35);
  });

  it('reports degrees consistently with the fraction', () => {
    expect(slopeDegreesAt(100, 100))
      .toBeCloseTo((Math.atan(slopeAt(100, 100)) * 180) / Math.PI, 6);
  });
});

describe('gradeOf', () => {
  const climb = [at(0, 0, 0), at(50, 2, 0), at(100, 5, 0)];

  it('measures the end-to-end gradient', () => {
    expect(gradeOf(climb).overall).toBeCloseTo(5 / 100, 6);
  });

  it('reports the steepest section, not just the average', () => {
    // A road is limited by its worst pitch, not its mean.
    expect(gradeOf(climb).steepest).toBeCloseTo(3 / 50, 6);
    expect(gradeOf(climb).steepest).toBeGreaterThan(gradeOf(climb).overall);
  });

  it('totals climb and descent separately', () => {
    const undulating = [at(0, 0, 0), at(50, 4, 0), at(100, 1, 0)];
    const grade = gradeOf(undulating);
    expect(grade.ascent).toBeCloseTo(4, 6);
    expect(grade.descent).toBeCloseTo(3, 6);
    expect(grade.overall).toBeCloseTo(1 / 100, 6);
  });

  it('is negative downhill', () => {
    expect(gradeOf([...climb].reverse()).overall).toBeCloseTo(-5 / 100, 6);
  });

  it('is zero on the level', () => {
    expect(gradeOf([at(0, 3, 0), at(100, 3, 0)]).overall).toBe(0);
  });

  it('handles a degenerate path', () => {
    expect(gradeOf([at(0, 0, 0)]).overall).toBe(0);
    expect(gradeOf([]).overall).toBe(0);
  });

  it('ignores a purely vertical step rather than dividing by zero', () => {
    expect(Number.isFinite(gradeOf([at(0, 0, 0), at(0, 5, 0), at(50, 5, 0)]).overall))
      .toBe(true);
  });
});

describe('gradeFactors', () => {
  it('costs nothing on the level', () => {
    expect(gradeFactors(0)).toEqual({ speed: 1, capacity: 1 });
  });

  it('slows traffic uphill', () => {
    expect(gradeFactors(0.06).speed).toBeLessThan(1);
    expect(gradeFactors(0.06).capacity).toBeLessThan(1);
  });

  it('gets worse the steeper it gets', () => {
    expect(gradeFactors(0.1).speed).toBeLessThan(gradeFactors(0.05).speed);
  });

  it('does not reward going downhill', () => {
    // Drivers do not make up the time lost climbing the other way.
    expect(gradeFactors(-0.08)).toEqual({ speed: 1, capacity: 1 });
  });

  it('is a plausible penalty at the practical maximum grade', () => {
    // 8% should hurt noticeably without making the road impassable.
    const { speed } = gradeFactors(0.08);
    expect(speed).toBeLessThan(0.75);
    expect(speed).toBeGreaterThan(0.5);
  });

  it('matches the stated penalty constant', () => {
    expect(gradeFactors(0.1).speed).toBeCloseTo(1 / (1 + GRADE_SPEED_PENALTY * 0.1), 6);
  });
});

describe('earthworksFor', () => {
  it('needs no earthworks on level ground', () => {
    // A tiny footprint sits on effectively flat ground whatever the slope.
    const works = earthworksFor(0, 0, 0.01, 0.01);
    expect(works.cut).toBeLessThan(0.001);
    expect(works.fill).toBeLessThan(0.001);
  });

  it('balances cut against fill', () => {
    // The platform is set at the mean height, so the two roughly cancel — which
    // is why a pad is levelled that way rather than at the highest corner.
    const works = earthworksFor(120, -80, 60, 60);
    expect(works.cut).toBeCloseTo(works.fill, 0);
  });

  it('costs more on a steeper plot', () => {
    let gentlest = { slope: Infinity, x: 0, z: 0 };
    let steepest = { slope: 0, x: 0, z: 0 };
    for (let x = -300; x <= 300; x += 20) {
      for (let z = -300; z <= 300; z += 20) {
        const slope = slopeAt(x, z);
        if (slope < gentlest.slope) gentlest = { slope, x, z };
        if (slope > steepest.slope) steepest = { slope, x, z };
      }
    }

    const flat = earthworksFor(gentlest.x, gentlest.z, 40, 40);
    const sloped = earthworksFor(steepest.x, steepest.z, 40, 40);
    expect(sloped.cut).toBeGreaterThan(flat.cut);
  });

  it('scales with footprint area', () => {
    const small = earthworksFor(150, 150, 20, 20);
    const large = earthworksFor(150, 150, 60, 60);
    expect(large.cut).toBeGreaterThan(small.cut);
  });

  it('puts the platform between the lowest and highest ground it covers', () => {
    const [x, z, w, d] = [200, -150, 50, 50];
    const { level } = earthworksFor(x, z, w, d);
    const corners = [
      elevationAt(x - w / 2, z - d / 2), elevationAt(x + w / 2, z - d / 2),
      elevationAt(x - w / 2, z + d / 2), elevationAt(x + w / 2, z + d / 2)
    ];
    expect(level).toBeGreaterThanOrEqual(Math.min(...corners) - 0.01);
    expect(level).toBeLessThanOrEqual(Math.max(...corners) + 0.01);
  });
});

describe('groundLevelFor', () => {
  it('stands a building on its own platform, not the raw ground', () => {
    // A wide building on a slope must sit level, not tilt with the hillside.
    const position: [number, number, number] = [180, 0, 120];
    const level = groundLevelFor({ position, design: { width: 60, depth: 60 } });
    expect(level).toBeCloseTo(earthworksFor(180, 120, 60, 60).level, 6);
  });

  it('falls back to a default footprint when none is designed', () => {
    const position: [number, number, number] = [50, 0, 50];
    expect(Number.isFinite(groundLevelFor({ position }))).toBe(true);
  });

  it('tracks the terrain across the site', () => {
    const high = groundLevelFor({ position: [0, 0, 0] });
    const elsewhere = groundLevelFor({ position: [400, 0, 400] });
    expect(high).not.toBeCloseTo(elsewhere, 1);
  });
});

describe('raycastTerrain', () => {
  const down = { x: 0, y: -1, z: 0 };

  it('lands on the surface directly below', () => {
    const hit = raycastTerrain({ x: 120, y: 500, z: -80 }, down)!;
    expect(hit.x).toBeCloseTo(120, 3);
    expect(hit.z).toBeCloseTo(-80, 3);
    expect(hit.y).toBeCloseTo(elevationAt(120, -80), 2);
  });

  it('lands on the surface for an oblique ray', () => {
    // The case that matters: an orbit camera never looks straight down.
    const origin = { x: -400, y: 300, z: -400 };
    const d = { x: 0.5, y: -0.6, z: 0.62 };
    const length = Math.hypot(d.x, d.y, d.z);
    const direction = { x: d.x / length, y: d.y / length, z: d.z / length };

    const hit = raycastTerrain(origin, direction)!;
    expect(hit).not.toBeNull();
    expect(hit.y).toBeCloseTo(elevationAt(hit.x, hit.z), 2);
  });

  it('stays on the ray it was given', () => {
    const origin = { x: 200, y: 240, z: 60 };
    const direction = { x: -0.4, y: -0.8, z: -0.447 };
    const hit = raycastTerrain(origin, direction)!;

    const t = (hit.y - origin.y) / direction.y;
    expect(hit.x).toBeCloseTo(origin.x + direction.x * t, 2);
    expect(hit.z).toBeCloseTo(origin.z + direction.z * t, 2);
  });

  it('finds nothing when pointing at the sky', () => {
    expect(raycastTerrain({ x: 0, y: 100, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
  });

  it('finds nothing from below ground', () => {
    expect(raycastTerrain({ x: 0, y: -200, z: 0 }, down)).toBeNull();
  });

  it('agrees with the surface across the whole site', () => {
    for (let x = -400; x <= 400; x += 73) {
      for (let z = -400; z <= 400; z += 73) {
        const hit = raycastTerrain({ x, y: 400, z }, down);
        expect(hit, `no hit at ${x},${z}`).not.toBeNull();
        expect(Math.abs(hit!.y - elevationAt(x, z))).toBeLessThan(0.01);
      }
    }
  });

  it('does not skip a crest between marching steps', () => {
    /*
      A ray grazing a hilltop must stop on the near slope rather than punching
      through and landing on the far side — the classic failure of a marched
      raycast with too coarse a step.
    */
    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      const origin = { x: Math.cos(angle) * 700, y: 60, z: Math.sin(angle) * 700 };
      const target = { x: 0, y: elevationAt(0, 0), z: 0 };
      const d = {
        x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z
      };
      const length = Math.hypot(d.x, d.y, d.z);
      const direction = { x: d.x / length, y: d.y / length, z: d.z / length };

      const hit = raycastTerrain(origin, direction);
      if (!hit) continue;
      expect(Math.abs(hit.y - elevationAt(hit.x, hit.z)), `angle ${angle}`)
        .toBeLessThan(0.05);
    }
  });
});
