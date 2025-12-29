import { HexCoord, createHexCoord, EdgeDirection } from '../types/CoordinateTypes';

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

/**
 * Edge wrapping mappings for the 19-hex board
 * These represent the "Post-Magellan" rule where opposite edges connect
 * Based on flag markings on the physical board
 */
export const EDGE_WRAPS: EdgeWrap[] = [
  // Top edge wraps to bottom edge (and vice versa)
  // Left edge wraps to right edge (and vice versa)
  // These will be defined based on the actual board design
  // For MVP, we can start without edge wrapping and add it later
];

/**
 * Check if a hex is on the board
 */
export function isOnBoard(coord: HexCoord): boolean {
  return BOARD_HEXES.some(hex => hex.q === coord.q && hex.r === coord.r);
}

/**
 * Get all valid adjacent hexes (considering board boundaries and wrapping)
 */
export function getValidNeighbors(coord: HexCoord): HexCoord[] {
  const neighbors: HexCoord[] = [];

  // Simple version without edge wrapping for MVP
  const directions = [
    createHexCoord(1, 0),   // East
    createHexCoord(1, -1),  // Northeast
    createHexCoord(0, -1),  // Northwest
    createHexCoord(-1, 0),  // West
    createHexCoord(-1, 1),  // Southwest
    createHexCoord(0, 1)    // Southeast
  ];

  for (const dir of directions) {
    const neighbor = createHexCoord(coord.q + dir.q, coord.r + dir.r);
    if (isOnBoard(neighbor)) {
      neighbors.push(neighbor);
    }
  }

  // TODO: Add edge wrapping logic here when implementing Post-Magellan rule

  return neighbors;
}

/**
 * Board center coordinates for rendering
 */
export const BOARD_CENTER = {
  x: 400,
  y: 300
};
