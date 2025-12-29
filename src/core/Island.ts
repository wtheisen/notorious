import { HexCoord, EdgeDirection } from '../types/CoordinateTypes';

/**
 * Represents an island on the board
 * Islands have impassable edges that block ship movement
 */
export class Island {
  public readonly name: string;
  public readonly hexCoord: HexCoord;
  public readonly impassableEdges: EdgeDirection[];
  public readonly icon: string;

  constructor(
    name: string,
    hexCoord: HexCoord,
    impassableEdges: EdgeDirection[],
    icon: string = ''
  ) {
    this.name = name;
    this.hexCoord = hexCoord;
    this.impassableEdges = impassableEdges;
    this.icon = icon;
  }

  /**
   * Check if an edge of this island is passable
   */
  isEdgePassable(edge: EdgeDirection): boolean {
    return !this.impassableEdges.includes(edge);
  }

  /**
   * Check if movement from this island to a specific direction is allowed
   */
  canSailInDirection(direction: EdgeDirection): boolean {
    return this.isEdgePassable(direction);
  }
}

/**
 * Island definitions for the game
 * These will be loaded from islands.json in a full implementation
 */
export const ISLAND_NAMES = [
  'Havana',
  'Nassau',
  'Tortuga',
  'Port Royal',
  'Hispaniola'
] as const;

export type IslandName = typeof ISLAND_NAMES[number];
