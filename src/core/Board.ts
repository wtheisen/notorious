import { HexCoord, hexToKey, createHexCoord } from '../types/CoordinateTypes';
import { Hex } from './Hex';
import { Island } from './Island';
import { Ship } from './Ship';
import { BOARD_HEXES, isOnBoard, getValidNeighbors } from '../config/HexConstants';
import { areAdjacent, findPath, getDirection } from '../utils/HexMath';

/**
 * Manages the game board with 19 hexes
 */
export class Board {
  private hexes: Map<string, Hex>;
  private islands: Island[];

  constructor() {
    this.hexes = new Map();
    this.islands = [];
    this.initializeBoard();
  }

  /**
   * Initialize the 19-hex board
   */
  private initializeBoard(): void {
    for (const coord of BOARD_HEXES) {
      const hex = new Hex(coord);
      this.hexes.set(hexToKey(coord), hex);
    }
  }

  /**
   * Get a hex at specific coordinates
   */
  getHex(coord: HexCoord): Hex | null {
    return this.hexes.get(hexToKey(coord)) || null;
  }

  /**
   * Get all hexes on the board
   */
  getAllHexes(): Hex[] {
    return Array.from(this.hexes.values());
  }

  /**
   * Get valid neighboring hexes (within board boundaries)
   */
  getNeighbors(coord: HexCoord): Hex[] {
    const neighborCoords = getValidNeighbors(coord);
    return neighborCoords
      .map(c => this.getHex(c))
      .filter((h): h is Hex => h !== null);
  }

  /**
   * Check if two hexes are adjacent
   */
  isAdjacent(coord1: HexCoord, coord2: HexCoord): boolean {
    return areAdjacent(coord1, coord2) && isOnBoard(coord1) && isOnBoard(coord2);
  }

  /**
   * Check if sailing between two hexes is possible
   * Considers island impassable edges
   */
  canSailBetween(from: HexCoord, to: HexCoord): boolean {
    if (!this.isAdjacent(from, to)) {
      return false;
    }

    const fromHex = this.getHex(from);
    const toHex = this.getHex(to);

    if (!fromHex || !toHex) {
      return false;
    }

    // Check if fromHex has an island with an impassable edge in the direction of toHex
    if (fromHex.island) {
      const direction = getDirection(from, to);
      if (direction !== -1 && !fromHex.island.canSailInDirection(direction)) {
        return false;
      }
    }

    // Check if toHex has an island with an impassable edge in the direction of fromHex
    if (toHex.island) {
      const direction = getDirection(to, from);
      if (direction !== -1 && !toHex.island.canSailInDirection(direction)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Place a ship on the board
   */
  placeShip(coord: HexCoord, ship: Ship): boolean {
    const hex = this.getHex(coord);
    if (!hex) return false;

    hex.addShip(ship);
    return true;
  }

  /**
   * Remove a ship from the board
   */
  removeShip(coord: HexCoord, ship: Ship): boolean {
    const hex = this.getHex(coord);
    if (!hex) return false;

    return hex.removeShip(ship);
  }

  /**
   * Move a ship from one hex to another
   * Returns true if successful
   */
  moveShip(from: HexCoord, to: HexCoord, ship: Ship): boolean {
    if (!this.canSailBetween(from, to)) {
      return false;
    }

    const fromHex = this.getHex(from);
    const toHex = this.getHex(to);

    if (!fromHex || !toHex) {
      return false;
    }

    // Remove from source
    if (!fromHex.removeShip(ship)) {
      return false;
    }

    // Add to destination
    toHex.addShip(ship);
    return true;
  }

  /**
   * Get the player who controls a hex
   */
  getHexController(coord: HexCoord): string | null {
    const hex = this.getHex(coord);
    return hex ? hex.getController() : null;
  }

  /**
   * Get total influence of a player in a hex
   */
  getInfluence(coord: HexCoord, playerId: string): number {
    const hex = this.getHex(coord);
    return hex ? hex.getInfluence(playerId) : 0;
  }

  /**
   * Find a path between two hexes
   * Considers island impassable edges and returns empty array if no path exists
   */
  findPath(from: HexCoord, to: HexCoord): HexCoord[] {
    return findPath(
      from,
      to,
      (coord) => {
        // A hex is blocked if it's not on the board
        return !isOnBoard(coord);
      },
      (fromHex, toHex) => {
        // Check if we can sail between these two hexes (respects island edges)
        return this.canSailBetween(fromHex, toHex);
      }
    );
  }

  /**
   * Place an island on the board
   */
  placeIsland(island: Island): boolean {
    const hex = this.getHex(island.hexCoord);
    if (!hex) return false;

    hex.island = island;
    this.islands.push(island);
    return true;
  }

  /**
   * Get all islands on the board
   */
  getIslands(): Island[] {
    return [...this.islands];
  }

  /**
   * Get an island at a specific hex
   */
  getIslandAt(coord: HexCoord): Island | null {
    const hex = this.getHex(coord);
    return hex?.island || null;
  }

  /**
   * Get all hexes controlled by a player
   */
  getControlledHexes(playerId: string): Hex[] {
    return this.getAllHexes().filter(hex => hex.getController() === playerId);
  }

  /**
   * Count hexes controlled by a player
   */
  countControlledHexes(playerId: string): number {
    return this.getControlledHexes(playerId).length;
  }

  /**
   * Get all hexes containing ships from a specific player
   */
  getHexesWithPlayerShips(playerId: string): Hex[] {
    return this.getAllHexes().filter(hex => hex.getPlayerShips(playerId).length > 0);
  }

  /**
   * Clear the board (for testing/reset)
   */
  clear(): void {
    this.hexes.clear();
    this.islands = [];
    this.initializeBoard();
  }
}
