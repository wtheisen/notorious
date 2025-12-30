import { PlayerState } from '../types/GameState';
import { ActionType, GAME_CONSTANTS } from '../../types/GameTypes';
import { AnyChart } from '../../core/Chart';

/**
 * Place a captain on an action during PLACE phase
 * Modifies player state (Immer will handle immutability)
 */
export function placeCaptain(player: PlayerState, action: ActionType): boolean {
  if (player.placedCaptains.length >= player.captainCount) {
    console.log(`[Player] ${player.name} cannot place captain - already placed ${player.placedCaptains.length}/${player.captainCount}`);
    return false;
  }

  player.placedCaptains.push(action);
  console.log(`[Player] ${player.name} placed captain on ${action}. Total: ${player.placedCaptains.length}/${player.captainCount}`);
  return true;
}

/**
 * Remove a captain from an action during PLAY phase
 * Returns the action type if successful, null otherwise
 */
export function removeCaptain(player: PlayerState): ActionType | null {
  if (player.placedCaptains.length === 0) {
    return null;
  }
  return player.placedCaptains.pop()!;
}

/**
 * Check if player has captains left to place
 */
export function hasUnplacedCaptains(player: PlayerState): boolean {
  return player.placedCaptains.length < player.captainCount;
}

/**
 * Reset captain placements for a new round
 */
export function resetCaptains(player: PlayerState): void {
  player.placedCaptains = [];
}

/**
 * Gain notoriety points
 * Automatically checks for captain unlocks
 */
export function gainNotoriety(player: PlayerState, amount: number): void {
  const oldNotoriety = player.notoriety;
  player.notoriety += amount;

  // Check for captain unlocks
  GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS.forEach(threshold => {
    if (oldNotoriety < threshold && player.notoriety >= threshold) {
      player.captainCount++;
      console.log(`[Player] ${player.name} unlocked captain! Now has ${player.captainCount} captains`);
    }
  });
}

/**
 * Gain doubloons
 */
export function gainDoubloons(player: PlayerState, amount: number): void {
  player.doubloons += amount;
}

/**
 * Spend doubloons (e.g., for bribes)
 * Returns true if successful, false if not enough doubloons
 */
export function spendDoubloons(player: PlayerState, amount: number): boolean {
  if (player.doubloons < amount) {
    return false;
  }
  player.doubloons -= amount;
  return true;
}

/**
 * Check if player has enough ships of a type
 */
export function hasShips(player: PlayerState, type: 'sloops' | 'galleons', count: number): boolean {
  return player.ships[type] >= count;
}

/**
 * Spend ships (when placing them on the board)
 */
export function spendShips(player: PlayerState, type: 'sloops' | 'galleons', count: number): boolean {
  if (!hasShips(player, type, count)) {
    return false;
  }
  player.ships[type] -= count;
  return true;
}

/**
 * Return ships to inventory (when they're removed from the board)
 */
export function returnShips(player: PlayerState, type: 'sloops' | 'galleons', count: number): void {
  player.ships[type] += count;
}

/**
 * Check if player has won
 */
export function hasPlayerWon(player: PlayerState): boolean {
  return player.notoriety >= GAME_CONSTANTS.WINNING_NOTORIETY;
}

/**
 * Get final score (notoriety + doubloons)
 */
export function getFinalScore(player: PlayerState): number {
  return player.notoriety + player.doubloons;
}

/**
 * Set port location
 */
export function setPortLocation(player: PlayerState, coord: { q: number; r: number; s: number }): void {
  player.portLocation = coord;
}

/**
 * Add a chart to player's hand
 */
export function addChart(player: PlayerState, chart: AnyChart): void {
  player.charts.push(chart);
  console.log(`[Player] ${player.name} gained chart: ${chart.type}`);
}

/**
 * Remove a chart from player's hand
 * Returns true if chart was found and removed, false otherwise
 */
export function removeChart(player: PlayerState, chartId: string): boolean {
  const index = player.charts.findIndex(c => c.id === chartId);
  if (index !== -1) {
    const removed = player.charts.splice(index, 1)[0];
    console.log(`[Player] ${player.name} removed chart: ${removed.type}`);
    return true;
  }
  return false;
}

/**
 * Get all charts held by player
 */
export function getCharts(player: PlayerState): AnyChart[] {
  return [...player.charts];
}

/**
 * Check if player has a specific chart
 */
export function hasChart(player: PlayerState, chartId: string): boolean {
  return player.charts.some(c => c.id === chartId);
}

/**
 * Get the number of charts held by player
 */
export function getChartCount(player: PlayerState): number {
  return player.charts.length;
}

/**
 * Check if any player has triggered game end (reached 24 notoriety)
 */
export function hasAnyPlayerTriggeredEnd(players: PlayerState[]): boolean {
  return players.some(p => p.notoriety >= GAME_CONSTANTS.WINNING_NOTORIETY);
}
