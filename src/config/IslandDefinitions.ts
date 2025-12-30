import { EdgeDirection } from '../types/CoordinateTypes';
import { IslandName } from '../core/Chart';

/**
 * Island definition with impassable edges
 */
export interface IslandDefinition {
  name: IslandName;
  impassableEdges: EdgeDirection[];
  icon: string; // Unicode character or emoji for visual representation
}

/**
 * The 5 islands in the game
 * Each island has specific edges that block ship movement
 *
 * Edge directions:
 * - NORTH = 0 (top edge)
 * - NORTHEAST = 1 (upper-right edge)
 * - SOUTHEAST = 2 (lower-right edge)
 * - SOUTH = 3 (bottom edge)
 * - SOUTHWEST = 4 (lower-left edge)
 * - NORTHWEST = 5 (upper-left edge)
 */
export const ISLAND_DEFINITIONS: IslandDefinition[] = [
  {
    name: 'Havana',
    impassableEdges: [EdgeDirection.NORTH, EdgeDirection.NORTHEAST],
    icon: '🏝️'
  },
  {
    name: 'Nassau',
    impassableEdges: [EdgeDirection.SOUTHEAST, EdgeDirection.SOUTH],
    icon: '🏴‍☠️'
  },
  {
    name: 'Tortuga',
    impassableEdges: [EdgeDirection.SOUTHWEST, EdgeDirection.NORTHWEST],
    icon: '⚓'
  },
  {
    name: 'Port Royal',
    impassableEdges: [EdgeDirection.NORTHEAST, EdgeDirection.SOUTHEAST],
    icon: '🏛️'
  },
  {
    name: 'Hispaniola',
    impassableEdges: [EdgeDirection.NORTH, EdgeDirection.SOUTH],
    icon: '🌴'
  }
];

/**
 * Get island definition by name
 */
export function getIslandDefinition(name: IslandName): IslandDefinition | undefined {
  return ISLAND_DEFINITIONS.find(def => def.name === name);
}

/**
 * Get all island names
 */
export function getAllIslandNames(): IslandName[] {
  return ISLAND_DEFINITIONS.map(def => def.name);
}
