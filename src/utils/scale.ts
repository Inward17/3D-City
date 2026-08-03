/**
 * Scale reference for the whole scene.
 *
 * **One world unit is one metre.** That convention is implied by
 * `STOREY_HEIGHT = 3.5` in buildingDimensions and by the capacity model, which
 * works in square metres per occupant — but until now nothing else honoured it.
 * Vehicles, street furniture and trees had each been sized by eye against
 * whatever happened to be next to them, so a bench came out longer than a bus
 * and street lamps stood three storeys tall.
 *
 * Everything below is a real-world figure. Geometry should be built from these
 * rather than from hand-tuned numbers, so that a change in one place can't
 * silently break proportion somewhere else.
 */

/** Passenger car: length x height x width, metres. Based on a typical saloon. */
export const CAR = { length: 4.6, height: 1.5, width: 1.8, wheelDiameter: 0.65 } as const;

/** City bus (rigid, two-axle). */
export const BUS = { length: 12, height: 3.2, width: 2.55, wheelDiameter: 1.0 } as const;

/** Rigid delivery truck. */
export const TRUCK = { length: 9.5, height: 3.6, width: 2.5, wheelDiameter: 0.9 } as const;

/**
 * Carriageway widths. A UK/EU lane is ~3.5 m; these are total road widths
 * including both directions plus a margin for kerbs.
 */
export const ROAD_WIDTH = {
  main: 14,        // dual two-lane with central marking
  secondary: 9,    // two lanes
  residential: 6   // single lane plus passing space
} as const;

/**
 * Free-flow speed by road class, in metres per second.
 *
 * Urban limits: 50 / 40 / 30 km/h. "Free-flow" means with no other traffic —
 * nothing here yet models a vehicle slowing for the one in front, so these are
 * the speeds actually driven. Congestion belongs to a later assignment step.
 */
export const FREE_FLOW_SPEED = {
  main: 50 / 3.6,        // 13.9 m/s
  secondary: 40 / 3.6,   // 11.1 m/s
  residential: 30 / 3.6  //  8.3 m/s
} as const;

/** Height above ground that the road surface is drawn at, to avoid z-fighting. */
export const ROAD_SURFACE_Y = 0.08;

/** Lane marking sits a hair above the tarmac for the same reason. */
export const ROAD_MARKING_Y = 0.12;

/** Street lamp: column height and the lantern that sits on top. */
export const STREET_LAMP = { height: 9, radius: 0.12, lanternRadius: 0.35 } as const;

/** Public bench. */
export const BENCH = { length: 1.8, seatHeight: 0.45, depth: 0.55, backHeight: 0.45 } as const;

/** Mature street tree. */
export const STREET_TREE = {
  trunkHeight: 3.2,
  trunkRadius: 0.18,
  canopyRadius: 2.8,
  totalHeight: 8
} as const;

/** Smaller ornamental tree used inside parks. */
export const PARK_TREE = {
  trunkHeight: 2.6,
  trunkRadius: 0.14,
  canopyRadius: 2.2
} as const;

/** Pavement/footway width beside a carriageway. */
export const PAVEMENT_WIDTH = 2.5;

/**
 * Sanity helper for tests: is a dimension within tolerance of its reference?
 * Keeps the assertion in one place rather than scattering magic numbers.
 */
export function withinTolerance(actual: number, expected: number, tolerance = 0.25): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / expected <= tolerance;
}
