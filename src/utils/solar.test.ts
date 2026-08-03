import { describe, it, expect } from 'vitest';
import {
  sunPosition, declination, dayLength, sunTimes, shadowRatio, dayOfYear,
  AXIAL_TILT, MAX_SHADOW_RATIO, KEY_DAYS
} from './solar';

// Day 81 is where this model's declination is exactly zero; the real
// equinox drifts by a few hours a year either side of it.
const EQUINOX = 81;
const MIDSUMMER = 172;   // ~21 June
const MIDWINTER = 355;   // ~21 December

const PUNE = 18.52;      // the app's default centre
const LONDON = 51.5;
const TROMSO = 69.65;    // inside the Arctic Circle

describe('declination', () => {
  it('is about zero at the equinox', () => {
    expect(Math.abs(declination(EQUINOX))).toBeLessThan(1);
  });

  it('reaches the axial tilt at midsummer', () => {
    expect(declination(MIDSUMMER)).toBeCloseTo(AXIAL_TILT, 0);
  });

  it('reaches its negative at midwinter', () => {
    expect(declination(MIDWINTER)).toBeCloseTo(-AXIAL_TILT, 0);
  });

  it('never exceeds the tilt', () => {
    for (let day = 1; day <= 365; day++) {
      expect(Math.abs(declination(day))).toBeLessThanOrEqual(AXIAL_TILT + 0.01);
    }
  });
});

describe('sunPosition', () => {
  it('puts the sun overhead at the equator at noon on the equinox', () => {
    const sun = sunPosition(0, EQUINOX, 12);
    expect(sun.elevation).toBeGreaterThan(89);
    expect(sun.direction[1]).toBeCloseTo(1, 2);
  });

  it('rises due east on the equinox', () => {
    // The definition of an equinox, and something the old fixed arc got right
    // only by accident — it did it every day of the year.
    const sun = sunPosition(LONDON, EQUINOX, 6.1);
    expect(sun.azimuth).toBeGreaterThan(85);
    expect(sun.azimuth).toBeLessThan(95);
  });

  it('sets due west on the equinox', () => {
    const sun = sunPosition(LONDON, EQUINOX, 17.9);
    expect(sun.azimuth).toBeGreaterThan(265);
    expect(sun.azimuth).toBeLessThan(275);
  });

  it('keeps the sun in the south at noon in the northern hemisphere', () => {
    for (const day of [EQUINOX, MIDSUMMER, MIDWINTER]) {
      const sun = sunPosition(LONDON, day, 12);
      expect(Math.abs(sun.azimuth - 180), `day ${day}`).toBeLessThan(1);
    }
  });

  it('keeps it in the north at noon in the southern hemisphere', () => {
    const sun = sunPosition(-33.9, MIDSUMMER, 12);   // Sydney, their midwinter
    const offNorth = Math.min(sun.azimuth, 360 - sun.azimuth);
    expect(offNorth).toBeLessThan(1);
  });

  it('is much lower at midwinter than midsummer', () => {
    const summer = sunPosition(LONDON, MIDSUMMER, 12).elevation;
    const winter = sunPosition(LONDON, MIDWINTER, 12).elevation;
    expect(summer - winter).toBeCloseTo(2 * AXIAL_TILT, 0);
  });

  it('is higher over Pune than over London at the same moment', () => {
    expect(sunPosition(PUNE, EQUINOX, 12).elevation)
      .toBeGreaterThan(sunPosition(LONDON, EQUINOX, 12).elevation);
  });

  it('is below the horizon at midnight', () => {
    const sun = sunPosition(LONDON, MIDSUMMER, 0);
    expect(sun.isUp).toBe(false);
    expect(sun.elevation).toBeLessThan(0);
  });

  it('returns a unit direction vector', () => {
    for (const hour of [0, 6, 9, 12, 15, 18, 23]) {
      const [x, y, z] = sunPosition(PUNE, MIDSUMMER, hour).direction;
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    }
  });

  it('moves east to west across the day, not the other way', () => {
    const morning = sunPosition(LONDON, EQUINOX, 9).direction[0];
    const afternoon = sunPosition(LONDON, EQUINOX, 15).direction[0];
    expect(morning).toBeGreaterThan(0);   // east
    expect(afternoon).toBeLessThan(0);    // west
  });

  it('points north-ish at noon in the northern hemisphere, meaning -Z', () => {
    // Sun in the south, so the vector towards it has a negative north component.
    expect(sunPosition(LONDON, EQUINOX, 12).direction[2]).toBeGreaterThan(0);
  });
});

describe('dayLength', () => {
  it('is twelve hours everywhere at the equinox', () => {
    for (const lat of [0, PUNE, LONDON, -33.9]) {
      expect(dayLength(lat, EQUINOX)).toBeCloseTo(12, 1);
    }
  });

  it('is always twelve hours at the equator', () => {
    for (const day of [EQUINOX, MIDSUMMER, MIDWINTER]) {
      expect(dayLength(0, day)).toBeCloseTo(12, 1);
    }
  });

  it('is longer in summer and shorter in winter, further from the equator', () => {
    const puneSwing = dayLength(PUNE, MIDSUMMER) - dayLength(PUNE, MIDWINTER);
    const londonSwing = dayLength(LONDON, MIDSUMMER) - dayLength(LONDON, MIDWINTER);
    expect(londonSwing).toBeGreaterThan(puneSwing);
  });

  it('gives midnight sun inside the Arctic Circle', () => {
    expect(dayLength(TROMSO, MIDSUMMER)).toBe(24);
  });

  it('gives polar night there in December', () => {
    expect(dayLength(TROMSO, MIDWINTER)).toBe(0);
  });

  it('has opposite seasons across the equator', () => {
    expect(dayLength(-LONDON, MIDSUMMER)).toBeLessThan(12);
    expect(dayLength(LONDON, MIDSUMMER)).toBeGreaterThan(12);
  });
});

describe('sunTimes', () => {
  it('is symmetric about solar noon', () => {
    const times = sunTimes(LONDON, MIDSUMMER)!;
    expect(times.sunrise + times.sunset).toBeCloseTo(24, 6);
  });

  it('matches the day length', () => {
    const times = sunTimes(LONDON, MIDWINTER)!;
    expect(times.sunset - times.sunrise).toBeCloseTo(dayLength(LONDON, MIDWINTER), 6);
  });

  it('has no sunrise during the polar night', () => {
    expect(sunTimes(TROMSO, MIDWINTER)).toBeNull();
  });

  it('agrees with sunPosition about when the sun is up', () => {
    const times = sunTimes(LONDON, MIDSUMMER)!;
    expect(sunPosition(LONDON, MIDSUMMER, times.sunrise + 0.2).isUp).toBe(true);
    expect(sunPosition(LONDON, MIDSUMMER, times.sunrise - 0.2).isUp).toBe(false);
  });
});

describe('shadowRatio', () => {
  it('is one when the sun is at 45 degrees', () => {
    expect(shadowRatio(45)).toBeCloseTo(1, 6);
  });

  it('is short when the sun is high', () => {
    expect(shadowRatio(80)).toBeLessThan(0.2);
  });

  it('is long when the sun is low', () => {
    expect(shadowRatio(10)).toBeGreaterThan(5);
  });

  it('is capped rather than infinite at the horizon', () => {
    expect(shadowRatio(0)).toBe(MAX_SHADOW_RATIO);
    expect(Number.isFinite(shadowRatio(0.0001))).toBe(true);
  });

  it('shows midwinter as the worst case for overshadowing', () => {
    const winter = shadowRatio(sunPosition(LONDON, MIDWINTER, 12).elevation);
    const summer = shadowRatio(sunPosition(LONDON, MIDSUMMER, 12).elevation);
    expect(winter).toBeGreaterThan(summer * 2);
  });
});

describe('dayOfYear', () => {
  it('is 1 on the first of January', () => {
    expect(dayOfYear(new Date(Date.UTC(2024, 0, 1)))).toBe(1);
  });

  it('reaches 365 at the end of a common year', () => {
    expect(dayOfYear(new Date(Date.UTC(2023, 11, 31)))).toBe(365);
  });

  it('accounts for the leap day', () => {
    expect(dayOfYear(new Date(Date.UTC(2024, 11, 31)))).toBe(366);
  });
});

describe('KEY_DAYS', () => {
  it('picks days that really are the extremes', () => {
    const byLabel = Object.fromEntries(KEY_DAYS.map(d => [d.label, d.day]));
    const noon = (day: number) => sunPosition(LONDON, day, 12).elevation;

    expect(noon(byLabel.Midsummer)).toBeGreaterThan(noon(byLabel.Equinox));
    expect(noon(byLabel.Equinox)).toBeGreaterThan(noon(byLabel.Midwinter));
  });
});
