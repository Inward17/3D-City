/**
 * Where the sun actually is.
 *
 * The scene used to swing a light along a fixed east-west arc — `[cos, sin,
 * 120]` — which put the sun in the same place on every day of the year at every
 * point on Earth. Noon was always directly overhead, the day was always twelve
 * hours, and the shadows were therefore decorative.
 *
 * Overshadowing is a real planning constraint, and the project already stores
 * the site's latitude and longitude without using them. With a genuine solar
 * position the shadows in the view are the ones the building will actually cast,
 * and the worst case — midwinter, when the sun is lowest and shadows longest —
 * can be checked directly.
 *
 * Scene convention: +X is east, -Z is north, +Y is up.
 */

/** Tilt of Earth's axis, degrees. */
export const AXIAL_TILT = 23.44;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Days from the start of the year, 1-366. */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

/**
 * Solar declination: how far north or south of the equator the sun is overhead.
 *
 * Zero at the equinoxes, ±23.44° at the solstices. This single number is what
 * makes a winter shadow study different from a summer one.
 */
export function declination(day: number): number {
  return toDegrees(
    Math.asin(
      Math.sin(toRadians(AXIAL_TILT)) *
      Math.sin(toRadians((360 / 365) * (day - 81)))
    )
  );
}

export interface SunPosition {
  /** Degrees above the horizon; negative means the sun has set. */
  elevation: number;
  /** Degrees clockwise from north: 90 is due east, 180 due south. */
  azimuth: number;
  /** Unit vector towards the sun in scene space. */
  direction: [number, number, number];
  /** False when the sun is below the horizon. */
  isUp: boolean;
}

/**
 * Sun position for a latitude, day and local solar hour.
 *
 * @param latitude degrees north, negative for the southern hemisphere
 * @param hour local solar time, 0-24
 */
export function sunPosition(latitude: number, day: number, hour: number): SunPosition {
  const lat = toRadians(latitude);
  const dec = toRadians(declination(day));

  // 15 degrees per hour, zero at solar noon.
  const hourAngle = toRadians(15 * (hour - 12));

  const sinElevation =
    Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.min(1, Math.max(-1, sinElevation)));

  /*
    Azimuth from the two-argument form rather than acos, which loses the sign
    and would mirror the afternoon sun back into the morning — the whole point
    of a shadow study being to tell the two apart.
  */
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)
  );

  // atan2 above measures from south; convert to the usual bearing from north.
  const bearing = (toDegrees(azimuth) + 180) % 360;
  const bearingRad = toRadians(bearing);

  const horizontal = Math.cos(elevation);

  return {
    elevation: toDegrees(elevation),
    azimuth: bearing,
    direction: [
      horizontal * Math.sin(bearingRad),   // east
      Math.sin(elevation),                 // up
      -horizontal * Math.cos(bearingRad)   // north is -Z
    ],
    isUp: elevation > 0
  };
}

/**
 * Hours of daylight at a latitude on a given day.
 *
 * Returns 24 inside the polar day and 0 inside the polar night, where the sun
 * never crosses the horizon and the usual formula has no solution.
 */
export function dayLength(latitude: number, day: number): number {
  const lat = toRadians(latitude);
  const dec = toRadians(declination(day));

  const cosHourAngle = -Math.tan(lat) * Math.tan(dec);
  if (cosHourAngle <= -1) return 24;
  if (cosHourAngle >= 1) return 0;

  return (2 * toDegrees(Math.acos(cosHourAngle))) / 15;
}

/** Solar times of sunrise and sunset, or null when the sun does not rise or set. */
export function sunTimes(
  latitude: number,
  day: number
): { sunrise: number; sunset: number } | null {
  const length = dayLength(latitude, day);
  if (length <= 0 || length >= 24) return null;
  return { sunrise: 12 - length / 2, sunset: 12 + length / 2 };
}

/**
 * Length of the shadow a vertical object casts, as a multiple of its height.
 *
 * The number planners actually argue over. Capped because the shadow tends to
 * infinity as the sun touches the horizon, where it stops meaning anything.
 */
export const MAX_SHADOW_RATIO = 20;

export function shadowRatio(elevationDegrees: number): number {
  if (elevationDegrees <= 0) return MAX_SHADOW_RATIO;
  return Math.min(MAX_SHADOW_RATIO, 1 / Math.tan(toRadians(elevationDegrees)));
}

/** Days worth checking in a shadow study: the extremes and the middle. */
export const KEY_DAYS = [
  { label: 'Midwinter', short: 'Winter', day: 355, hint: 'Lowest sun, longest shadows' },
  { label: 'Equinox', short: 'Equinox', day: 81, hint: 'Sun due east and west' },
  { label: 'Midsummer', short: 'Summer', day: 172, hint: 'Highest sun, longest day' }
] as const;
