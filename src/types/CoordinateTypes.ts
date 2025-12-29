/**
 * Axial coordinate system for hexagonal grid
 * q + r + s = 0 (cube coordinate constraint)
 */
export interface HexCoord {
  q: number;  // column
  r: number;  // row
  s: number;  // computed: -(q + r)
}

/**
 * Pixel coordinates for rendering
 */
export interface PixelCoord {
  x: number;
  y: number;
}

/**
 * Edge directions for hex grid (6 directions)
 */
export enum EdgeDirection {
  NORTH = 0,
  NORTHEAST = 1,
  SOUTHEAST = 2,
  SOUTH = 3,
  SOUTHWEST = 4,
  NORTHWEST = 5
}

/**
 * Helper to create a HexCoord with automatic s calculation
 */
export function createHexCoord(q: number, r: number): HexCoord {
  return { q, r, s: -(q + r) };
}

/**
 * Check if two hex coordinates are equal
 */
export function hexEquals(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * Create a string key for a HexCoord (for use in Maps)
 */
export function hexToKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

/**
 * Parse a hex key back to coordinates
 */
export function keyToHex(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return createHexCoord(q, r);
}
