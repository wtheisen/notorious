import { TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from './Chart';
import { Board } from './Board';
import { ShipType } from '../types/GameTypes';
import { ValidationResult } from '../types/GameTypes';

/**
 * Validates chart claiming requirements
 * Each chart type has different requirements
 */
export class ChartValidator {
  /**
   * Validate if a Treasure Map can be claimed
   *
   * Requirements:
   * - Must have a Galleon in the target hex
   * - Must control the target hex
   *
   * Reward: 1 Doubloon per player in the game
   */
  canClaimTreasureMap(
    chart: TreasureMapChart,
    playerId: string,
    board: Board
  ): ValidationResult {
    const hex = board.getHex(chart.targetHex);
    if (!hex) {
      return { valid: false, reason: 'Target hex not found' };
    }

    // Must have a Galleon in the hex
    const playerShips = hex.getPlayerShips(playerId);
    const hasGalleon = playerShips.some(ship => ship.type === ShipType.GALLEON);
    if (!hasGalleon) {
      return {
        valid: false,
        reason: `Need a Galleon at (${chart.targetHex.q}, ${chart.targetHex.r}) to claim Treasure Map`
      };
    }

    // Must control the hex
    const controller = hex.getController();
    if (controller !== playerId) {
      return {
        valid: false,
        reason: `Must control hex (${chart.targetHex.q}, ${chart.targetHex.r}) to claim Treasure Map`
      };
    }

    return { valid: true };
  }

  /**
   * Validate if an Island Raid can be claimed
   *
   * Requirements:
   * - Must have a Galleon on the island
   * - Must control the island
   * - Island Raid must have at least 2 doubloons on it
   *
   * Reward: 4 Notoriety + all doubloons on the Island Raid
   */
  canClaimIslandRaid(
    chart: IslandRaidChart,
    playerId: string,
    board: Board
  ): ValidationResult {
    // Find the island
    const island = board.getIslands().find(i => i.name === chart.targetIsland);
    if (!island) {
      return { valid: false, reason: `Island ${chart.targetIsland} not found` };
    }

    const hex = board.getHex(island.hexCoord);
    if (!hex) {
      return { valid: false, reason: 'Island hex not found' };
    }

    // Must have a Galleon on the island
    const playerShips = hex.getPlayerShips(playerId);
    const hasGalleon = playerShips.some(ship => ship.type === ShipType.GALLEON);
    if (!hasGalleon) {
      return {
        valid: false,
        reason: `Need a Galleon on ${chart.targetIsland} to claim Island Raid`
      };
    }

    // Must control the island
    const controller = hex.getController();
    if (controller !== playerId) {
      return {
        valid: false,
        reason: `Must control ${chart.targetIsland} to claim Island Raid`
      };
    }

    // Must have at least 2 doubloons on the chart
    if (chart.doubloonsOnChart < 2) {
      return {
        valid: false,
        reason: `Island Raid needs at least 2 doubloons (currently has ${chart.doubloonsOnChart})`
      };
    }

    return { valid: true };
  }

  /**
   * Validate if a Smuggler Route can be claimed
   *
   * Requirements:
   * - Must have a sailable path of player's pieces between the two islands (including the islands)
   * - Don't need to control the hexes, just have at least 1 piece in each hex on the path
   *
   * Reward: Doubloons equal to the number of hexes in the shortest valid path
   */
  canClaimSmugglerRoute(
    chart: SmugglerRouteChart,
    playerId: string,
    board: Board
  ): ValidationResult {
    // Find both islands
    const islandA = board.getIslands().find(i => i.name === chart.islandA);
    const islandB = board.getIslands().find(i => i.name === chart.islandB);

    if (!islandA || !islandB) {
      return { valid: false, reason: 'One or both islands not found' };
    }

    // Find shortest sailable path between islands
    const path = board.findPath(islandA.hexCoord, islandB.hexCoord);

    if (path.length === 0) {
      return {
        valid: false,
        reason: `No sailable path exists between ${chart.islandA} and ${chart.islandB}`
      };
    }

    // Check that player has at least one piece in every hex on the path
    for (const hexCoord of path) {
      const hex = board.getHex(hexCoord);
      if (!hex) {
        return {
          valid: false,
          reason: `Hex at (${hexCoord.q}, ${hexCoord.r}) not found on path`
        };
      }

      const playerShips = hex.getPlayerShips(playerId);
      if (playerShips.length === 0) {
        return {
          valid: false,
          reason: `Need at least one ship at (${hexCoord.q}, ${hexCoord.r}) to claim Smuggler Route`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Calculate the reward for claiming a Smuggler Route
   * Returns the number of doubloons (length of shortest path)
   */
  calculateSmugglerRouteReward(
    chart: SmugglerRouteChart,
    board: Board
  ): number {
    const islandA = board.getIslands().find(i => i.name === chart.islandA);
    const islandB = board.getIslands().find(i => i.name === chart.islandB);

    if (!islandA || !islandB) {
      return 0;
    }

    const path = board.findPath(islandA.hexCoord, islandB.hexCoord);
    return path.length;
  }
}
