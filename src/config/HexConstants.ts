import { HexCoord, createHexCoord, hexEquals, EdgeDirection } from '../types/CoordinateTypes';

/**
 * The 19 hexes that make up the game board
 * Centered at (0, 0, 0) in axial coordinates
 * Arranged in a hexagonal pattern (like Catan) with radius 2
 *
 * Layout visualization (q, r):
 *           (-2,-2) (-1,-2) (0,-2)
 *         (-2,-1) (-1,-1) (0,-1) (1,-1)
 *       (-2,0) (-1,0) (0,0) (1,0) (2,0)
 *         (-1,1) (0,1) (1,1) (2,1)
 *           (0,2) (1,2) (2,2)
 */
export const BOARD_HEXES: HexCoord[] = [
  // Center hex
  createHexCoord(0, 0),

  // Ring 1 (6 hexes around center)
  createHexCoord(1, 0),
  createHexCoord(1, -1),
  createHexCoord(0, -1),
  createHexCoord(-1, 0),
  createHexCoord(-1, 1),
  createHexCoord(0, 1),

  // Ring 2 (12 hexes on outer edge)
  createHexCoord(0, -2),
  createHexCoord(1, -2),
  createHexCoord(2, -2),
  createHexCoord(2, -1),
  createHexCoord(2, 0),
  createHexCoord(1, 1),
  createHexCoord(0, 2),
  createHexCoord(-1, 2),
  createHexCoord(-2, 2),
  createHexCoord(-2, 1),
  createHexCoord(-2, 0),
  createHexCoord(-1, -1)
];

/** Direction vectors for the 6 hex neighbors in axial coordinates */
const DIRECTIONS: HexCoord[] = [
  createHexCoord(1, 0),   // 0: East
  createHexCoord(1, -1),  // 1: Northeast
  createHexCoord(0, -1),  // 2: Northwest
  createHexCoord(-1, 0),  // 3: West
  createHexCoord(-1, 1),  // 4: Southwest
  createHexCoord(0, 1)    // 5: Southeast
];

/**
 * Edge wrapping rules for "Post-Magellan" board wrapping
 * Maps edge hexes to their wrapped counterparts
 * Format: { hex: HexCoord, edge: EdgeDirection, wrapsTo: { hex: HexCoord, edge: EdgeDirection } }
 */
export interface EdgeWrap {
  hex: HexCoord;
  edge: EdgeDirection;
  wrapsTo: {
    hex: HexCoord;
    edge: EdgeDirection;
  };
}

/** Precomputed set for O(1) board membership checks */
const BOARD_HEX_SET = new Set(BOARD_HEXES.map(h => `${h.q},${h.r}`));

/**
 * Check if a hex is on the board
 */
export function isOnBoard(coord: HexCoord): boolean {
  return BOARD_HEX_SET.has(`${coord.q},${coord.r}`);
}

/**
 * Edge wrap table: for each outer hex + off-board direction, the wrap target is (-q, -r).
 * Built once at module load.
 * Key: "q,r,dir" → target HexCoord
 */
interface WrapEntry {
  from: HexCoord;
  direction: number;
  to: HexCoord;
}

function buildWrapTable(): WrapEntry[] {
  const entries: WrapEntry[] = [];
  for (const hex of BOARD_HEXES) {
    // Only outer ring hexes (distance 2 from center)
    if (Math.abs(hex.q) + Math.abs(hex.r) + Math.abs(hex.s) !== 4) continue;

    for (let d = 0; d < 6; d++) {
      const dir = DIRECTIONS[d];
      const neighbor = createHexCoord(hex.q + dir.q, hex.r + dir.r);
      if (!isOnBoard(neighbor)) {
        // Wrap to opposite hex
        const target = createHexCoord(-hex.q, -hex.r);
        entries.push({ from: hex, direction: d, to: target });
      }
    }
  }
  return entries;
}

const WRAP_TABLE = buildWrapTable();

/** Lookup map for fast wrap queries: "q,r" → array of { direction, to } */
const WRAP_LOOKUP = new Map<string, { direction: number; to: HexCoord }[]>();
for (const entry of WRAP_TABLE) {
  const key = `${entry.from.q},${entry.from.r}`;
  if (!WRAP_LOOKUP.has(key)) WRAP_LOOKUP.set(key, []);
  WRAP_LOOKUP.get(key)!.push({ direction: entry.direction, to: entry.to });
}

/**
 * Edge wrapping mappings (exported for reference)
 */
export const EDGE_WRAPS: WrapEntry[] = WRAP_TABLE;

/**
 * Get the wrapped neighbor for an edge hex in a given off-board direction.
 * Returns null if no wrap exists for that hex/direction.
 */
export function getWrappedNeighbor(coord: HexCoord, direction: number): HexCoord | null {
  const entries = WRAP_LOOKUP.get(`${coord.q},${coord.r}`);
  if (!entries) return null;
  const entry = entries.find(e => e.direction === direction);
  return entry?.to ?? null;
}

/**
 * Check if two hexes are connected by edge wrapping.
 * Returns true if traveling from `from` to `to` is a valid wrap.
 */
export function isWrappedNeighbor(from: HexCoord, to: HexCoord): boolean {
  const entries = WRAP_LOOKUP.get(`${from.q},${from.r}`);
  if (!entries) return false;
  return entries.some(e => hexEquals(e.to, to));
}

/**
 * Get the direction index for a wrap connection from→to.
 * Returns -1 if no wrap connection exists.
 */
export function getWrapDirection(from: HexCoord, to: HexCoord): number {
  const entries = WRAP_LOOKUP.get(`${from.q},${from.r}`);
  if (!entries) return -1;
  const entry = entries.find(e => hexEquals(e.to, to));
  return entry?.direction ?? -1;
}

/**
 * Get all valid adjacent hexes (considering board boundaries and wrapping)
 */
export function getValidNeighbors(coord: HexCoord): HexCoord[] {
  const neighbors: HexCoord[] = [];

  for (let d = 0; d < 6; d++) {
    const dir = DIRECTIONS[d];
    const neighbor = createHexCoord(coord.q + dir.q, coord.r + dir.r);
    if (isOnBoard(neighbor)) {
      neighbors.push(neighbor);
    } else {
      // Check for edge wrap
      const wrapped = getWrappedNeighbor(coord, d);
      if (wrapped) {
        neighbors.push(wrapped);
      }
    }
  }

  return neighbors;
}

/**
 * Board center coordinates for rendering
 */
export const BOARD_CENTER = {
  x: 400,
  y: 300
};
