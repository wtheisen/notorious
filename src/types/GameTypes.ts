import { HexCoord } from './CoordinateTypes';

/**
 * Game phases
 */
export enum GamePhase {
  SETUP = 'SETUP',
  PLACE = 'PLACE',
  PLAY = 'PLAY',
  PIRATE = 'PIRATE',
  GAME_OVER = 'GAME_OVER'
}

/**
 * Turn order direction determined by Wind
 */
export enum WindDirection {
  CLOCKWISE = 'CLOCKWISE',
  COUNTERCLOCKWISE = 'COUNTERCLOCKWISE'
}

/**
 * Ship types with their influence values
 */
export enum ShipType {
  SLOOP = 'SLOOP',        // 1 influence
  GALLEON = 'GALLEON',    // 2 influence
  PORT = 'PORT'           // 3 influence
}

/**
 * The 5 main actions in the game
 */
export enum ActionType {
  SAIL = 'SAIL',
  STEAL = 'STEAL',
  BUILD = 'BUILD',
  SINK = 'SINK',
  CHART = 'CHART'
}

/**
 * Chart types
 */
export enum ChartType {
  TREASURE_MAP = 'TREASURE_MAP',
  ISLAND_RAID = 'ISLAND_RAID',
  SMUGGLER_ROUTE = 'SMUGGLER_ROUTE'
}

/**
 * Player colors
 */
export enum PlayerColor {
  BLUE = 'BLUE',
  RED = 'RED',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW'
}

/**
 * Ship inventory for a player
 */
export interface ShipInventory {
  sloops: number;
  galleons: number;
}

/**
 * Result of an action execution
 */
export interface ActionResult {
  success: boolean;
  message: string;
  notorietyGained?: number;
  doubloonsGained?: number;
  doubloonsSpent?: number;
}

/**
 * Validation result for an action
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * State change callback for observer pattern
 */
export type StateChangeCallback = () => void;

/**
 * Configuration for game constants
 */
export const GAME_CONSTANTS = {
  WINNING_NOTORIETY: 24,
  STARTING_CAPTAINS: 2,
  CAPTAIN_UNLOCK_THRESHOLDS: [5, 12],
  STARTING_SLOOPS: 4,
  STARTING_GALLEONS: 2,
  STARTING_DOUBLOONS: 0,
  HEX_COUNT: 19,
  ISLAND_COUNT: 5,
  INFLUENCE_VALUES: {
    [ShipType.SLOOP]: 1,
    [ShipType.GALLEON]: 2,
    [ShipType.PORT]: 3
  }
} as const;
