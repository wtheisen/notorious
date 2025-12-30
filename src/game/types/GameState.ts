import { PlayerColor, ActionType, ShipType, WindDirection, PiratePower } from '../../types/GameTypes';
import { HexCoord } from '../../types/CoordinateTypes';
import { AnyChart } from '../../core/Chart';
import { Island } from '../../core/Island';

/**
 * Ship representation for boardgame.io state
 * Plain object instead of class
 */
export interface Ship {
  type: ShipType;
  playerId: string;
}

/**
 * Hex state representation for boardgame.io
 * Plain object instead of class with Map
 */
export interface HexState {
  coord: HexCoord;
  ships: Ship[];
  island: Island | null;
}

/**
 * Board state representation for boardgame.io
 * Uses Record instead of Map for serialization
 */
export interface BoardState {
  hexes: Record<string, HexState>;  // key format: "q,r"
}

/**
 * Player state representation for boardgame.io
 * Plain object instead of class
 */
export interface PlayerState {
  id: string;
  name: string;
  color: PlayerColor;
  isAI: boolean;
  piratePower: PiratePower;

  // Resources
  notoriety: number;
  doubloons: number;
  captainCount: number;
  ships: {
    sloops: number;
    galleons: number;
  };
  portLocation: HexCoord | null;

  // Captain placements during PLACE phase
  placedCaptains: ActionType[];

  // Charts held by player
  charts: AnyChart[];
}

/**
 * Chart deck state for boardgame.io
 */
export interface ChartDeckState {
  drawPile: AnyChart[];      // Shuffled deck to draw from
  discardPile: AnyChart[];   // Discarded charts
  islandRaids: AnyChart[];   // Island raids (publicly visible)
}

/**
 * Main game state for boardgame.io
 * This is the 'G' object that boardgame.io manages
 */
export interface NotoriousState {
  players: PlayerState[];
  board: BoardState;
  chartDeck: ChartDeckState;
  windDirection: WindDirection;
  windTokenHolder: string | null;

  // Setup phase tracking
  setupComplete: boolean[];  // Track which players have completed setup

  // Game end tracking - finish the round when someone reaches 24 notoriety
  gameEndTriggered: boolean;

  // Pirate phase tracking - counts how many players have finished claiming
  piratePhaseTurnsComplete: number;

  // Phase and turn tracking is handled by boardgame.io ctx
  // We don't need currentPhase, activePlayerIndex, etc.
}

/**
 * Helper to convert HexCoord to string key for Record
 */
export function hexToKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

/**
 * Helper to convert string key back to HexCoord
 */
export function keyToHex(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r, s: -q - r };
}
