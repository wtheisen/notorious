import { HexCoord } from '../types/CoordinateTypes';
import { Ship } from './Ship';
import { Island } from './Island';

/**
 * Represents a single hex on the board
 * Contains ships from different players and potentially an island
 */
export class Hex {
  public readonly coord: HexCoord;
  private ships: Map<string, Ship[]>; // playerId -> ships
  public island: Island | null;

  constructor(coord: HexCoord, island: Island | null = null) {
    this.coord = coord;
    this.ships = new Map();
    this.island = island;
  }

  /**
   * Add a ship to this hex
   */
  addShip(ship: Ship): void {
    const playerShips = this.ships.get(ship.playerId) || [];
    playerShips.push(ship);
    this.ships.set(ship.playerId, playerShips);
  }

  /**
   * Remove a ship from this hex
   * Returns true if the ship was found and removed
   */
  removeShip(ship: Ship): boolean {
    const playerShips = this.ships.get(ship.playerId);
    if (!playerShips) return false;

    const index = playerShips.findIndex(s => s.equals(ship));
    if (index === -1) return false;

    playerShips.splice(index, 1);

    if (playerShips.length === 0) {
      this.ships.delete(ship.playerId);
    }

    return true;
  }

  /**
   * Get all ships belonging to a specific player
   */
  getPlayerShips(playerId: string): Ship[] {
    return this.ships.get(playerId) || [];
  }

  /**
   * Get all ships in this hex
   */
  getAllShips(): Ship[] {
    const allShips: Ship[] = [];
    for (const playerShips of this.ships.values()) {
      allShips.push(...playerShips);
    }
    return allShips;
  }

  /**
   * Calculate total influence for a player in this hex
   */
  getInfluence(playerId: string): number {
    const playerShips = this.ships.get(playerId) || [];
    return playerShips.reduce((total, ship) => total + ship.influence, 0);
  }

  /**
   * Get the player who controls this hex (most influence)
   * Returns null if no player has ships or if there's a tie
   */
  getController(): string | null {
    if (this.ships.size === 0) return null;

    const influences = new Map<string, number>();

    for (const [playerId, playerShips] of this.ships.entries()) {
      const influence = playerShips.reduce((total, ship) => total + ship.influence, 0);
      influences.set(playerId, influence);
    }

    let maxInfluence = 0;
    let controller: string | null = null;
    let tieExists = false;

    for (const [playerId, influence] of influences.entries()) {
      if (influence > maxInfluence) {
        maxInfluence = influence;
        controller = playerId;
        tieExists = false;
      } else if (influence === maxInfluence && influence > 0) {
        tieExists = true;
      }
    }

    return tieExists ? null : controller;
  }

  /**
   * Check if this hex is empty (no ships)
   */
  isEmpty(): boolean {
    return this.ships.size === 0;
  }

  /**
   * Check if this hex has an island
   */
  hasIsland(): boolean {
    return this.island !== null;
  }

  /**
   * Get all player IDs that have ships in this hex
   */
  getPlayerIds(): string[] {
    return Array.from(this.ships.keys());
  }

  /**
   * Clear all ships from this hex (for testing/reset)
   */
  clear(): void {
    this.ships.clear();
  }
}
