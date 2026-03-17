import { HexCoord, EdgeDirection } from '../types/CoordinateTypes';

/**
 * Represents an island on the board (plain object for boardgame.io serialization)
 */
export interface Island {
  name: string;
  hexCoord: HexCoord;
  impassableEdges: EdgeDirection[];
  icon: string;
}

/**
 * Create an Island plain object
 */
export function createIsland(
  name: string,
  hexCoord: HexCoord,
  impassableEdges: EdgeDirection[],
  icon: string = ''
): Island {
  return { name, hexCoord, impassableEdges, icon };
}

/**
 * Check if an edge of this island is passable
 */
export function isEdgePassable(island: Island, edge: EdgeDirection): boolean {
  return !island.impassableEdges.includes(edge);
}

/**
 * Check if movement from this island in a specific direction is allowed
 */
export function canSailInDirection(island: Island, direction: EdgeDirection): boolean {
  return isEdgePassable(island, direction);
}

/**
 * Island definitions for the game
 */
export const ISLAND_NAMES = [
  'Havana',
  'Nassau',
  'Tortuga',
  'Port Royal',
  'Hispaniola'
] as const;

export type IslandName = typeof ISLAND_NAMES[number];
