import { HexCoord, PixelCoord, EdgeDirection, createHexCoord, hexEquals } from '../types/CoordinateTypes';

/**
 * Hex grid math utilities using axial coordinate system
 * Based on Red Blob Games hex grid guide
 */

// Hex size and layout constants
export const HEX_SIZE = 50; // Radius of hexagon
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const HEX_HEIGHT = 2 * HEX_SIZE;

/**
 * Direction vectors for the 6 hex neighbors in axial coordinates
 */
const DIRECTION_VECTORS: HexCoord[] = [
  createHexCoord(1, 0),   // East
  createHexCoord(1, -1),  // Northeast
  createHexCoord(0, -1),  // Northwest
  createHexCoord(-1, 0),  // West
  createHexCoord(-1, 1),  // Southwest
  createHexCoord(0, 1)    // Southeast
];

/**
 * Get neighbor hex in a specific direction
 */
export function getNeighbor(coord: HexCoord, direction: number): HexCoord {
  const dir = DIRECTION_VECTORS[direction % 6];
  return createHexCoord(coord.q + dir.q, coord.r + dir.r);
}

/**
 * Get all 6 neighbors of a hex
 */
export function getAllNeighbors(coord: HexCoord): HexCoord[] {
  return DIRECTION_VECTORS.map(dir =>
    createHexCoord(coord.q + dir.q, coord.r + dir.r)
  );
}

/**
 * Calculate distance between two hexes (Manhattan distance in cube coordinates)
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

/**
 * Check if two hexes are adjacent (distance = 1)
 */
export function areAdjacent(a: HexCoord, b: HexCoord): boolean {
  return hexDistance(a, b) === 1;
}

/**
 * Convert hex coordinates to pixel coordinates (for rendering)
 * Using flat-top hex orientation
 */
export function hexToPixel(coord: HexCoord, centerX: number = 0, centerY: number = 0): PixelCoord {
  const x = HEX_SIZE * (Math.sqrt(3) * coord.q + Math.sqrt(3) / 2 * coord.r) + centerX;
  const y = HEX_SIZE * (3 / 2 * coord.r) + centerY;
  return { x, y };
}

/**
 * Convert pixel coordinates to hex coordinates (for click detection)
 * Returns the hex at the given pixel position
 */
export function pixelToHex(pixel: PixelCoord, centerX: number = 0, centerY: number = 0): HexCoord {
  // Adjust for center offset
  const x = pixel.x - centerX;
  const y = pixel.y - centerY;

  // Flat-top hex math
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / HEX_SIZE;
  const r = (2 / 3 * y) / HEX_SIZE;

  return hexRound(createHexCoord(q, r));
}

/**
 * Round fractional hex coordinates to the nearest integer hex
 */
function hexRound(coord: HexCoord): HexCoord {
  let q = Math.round(coord.q);
  let r = Math.round(coord.r);
  let s = Math.round(coord.s);

  const qDiff = Math.abs(q - coord.q);
  const rDiff = Math.abs(r - coord.r);
  const sDiff = Math.abs(s - coord.s);

  // Fix rounding errors to maintain q + r + s = 0
  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return createHexCoord(q, r);
}

/**
 * Get the direction from one hex to an adjacent hex
 * Returns -1 if hexes are not adjacent
 */
export function getDirection(from: HexCoord, to: HexCoord): number {
  if (!areAdjacent(from, to)) return -1;

  for (let i = 0; i < 6; i++) {
    const neighbor = getNeighbor(from, i);
    if (hexEquals(neighbor, to)) {
      return i;
    }
  }
  return -1;
}

/**
 * Find a path between two hexes (simple BFS)
 * Returns array of hex coordinates forming the path (including start and end)
 * Returns empty array if no path exists
 */
export function findPath(
  start: HexCoord,
  end: HexCoord,
  isBlocked: (coord: HexCoord) => boolean,
  canTraverse?: (from: HexCoord, to: HexCoord) => boolean
): HexCoord[] {
  if (hexEquals(start, end)) return [start];
  if (isBlocked(end)) return [];

  const queue: { coord: HexCoord; path: HexCoord[] }[] = [{ coord: start, path: [start] }];
  const visited = new Set<string>();
  visited.add(`${start.q},${start.r}`);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighbor of getAllNeighbors(current.coord)) {
      const key = `${neighbor.q},${neighbor.r}`;

      if (visited.has(key)) continue;
      if (isBlocked(neighbor)) continue;

      // NEW: Check if edge between hexes is traversable (for island edges)
      if (canTraverse && !canTraverse(current.coord, neighbor)) {
        continue;
      }

      visited.add(key);
      const newPath = [...current.path, neighbor];

      if (hexEquals(neighbor, end)) {
        return newPath;
      }

      queue.push({ coord: neighbor, path: newPath });
    }
  }

  return []; // No path found
}

/**
 * Get all hexes within a certain range
 */
export function getHexesInRange(center: HexCoord, range: number): HexCoord[] {
  const results: HexCoord[] = [];

  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      const hex = createHexCoord(center.q + q, center.r + r);
      results.push(hex);
    }
  }

  return results;
}

/**
 * Draw a hexagon path for rendering
 * Returns array of corner points in pixel coordinates
 */
export function getHexCorners(center: PixelCoord, size: number = HEX_SIZE): PixelCoord[] {
  const corners: PixelCoord[] = [];

  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30; // Flat-top orientation
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad)
    });
  }

  return corners;
}
