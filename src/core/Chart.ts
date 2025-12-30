import { HexCoord } from '../types/CoordinateTypes';
import { ChartType } from '../types/GameTypes';

/**
 * Island names in the game
 */
export type IslandName = 'Havana' | 'Nassau' | 'Tortuga' | 'Port Royal' | 'Hispaniola';

/**
 * Base chart interface
 */
export interface BaseChart {
  id: string;
  type: ChartType;
  isRevealed: boolean; // Public (Island Raid) vs hidden (Treasure Map, Smuggler Route)
}

/**
 * Treasure Map Chart
 * Hidden chart that requires controlling a specific ocean hex
 * Pays 1 doubloon per player in the game
 */
export interface TreasureMapChart extends BaseChart {
  type: ChartType.TREASURE_MAP;
  targetHex: HexCoord;
  isRevealed: false; // Always hidden
}

/**
 * Island Raid Chart
 * Public chart that requires controlling a specific island
 * Pays notoriety and doubloons
 * Grows doubloons each Pirate Phase if unclaimed
 */
export interface IslandRaidChart extends BaseChart {
  type: ChartType.ISLAND_RAID;
  targetIsland: IslandName;
  doubloonsOnChart: number; // Grows by 1 each Pirate Phase
  notorietyReward: number; // Always 4
  isRevealed: true; // Always public
}

/**
 * Smuggler Route Chart
 * Hidden chart that requires continuous string of pieces between two islands
 * Pays doubloons relative to path length
 */
export interface SmugglerRouteChart extends BaseChart {
  type: ChartType.SMUGGLER_ROUTE;
  islandA: IslandName;
  islandB: IslandName;
  isRevealed: false; // Always hidden
}

/**
 * Union type for any chart
 */
export type AnyChart = TreasureMapChart | IslandRaidChart | SmugglerRouteChart;

/**
 * Factory functions for creating charts
 */
export class ChartFactory {
  private static chartIdCounter = 0;

  /**
   * Generate unique chart ID
   */
  private static generateId(): string {
    return `chart-${this.chartIdCounter++}`;
  }

  /**
   * Create a Treasure Map chart
   */
  static createTreasureMap(targetHex: HexCoord): TreasureMapChart {
    return {
      id: this.generateId(),
      type: ChartType.TREASURE_MAP,
      isRevealed: false,
      targetHex
    };
  }

  /**
   * Create an Island Raid chart
   */
  static createIslandRaid(targetIsland: IslandName): IslandRaidChart {
    return {
      id: this.generateId(),
      type: ChartType.ISLAND_RAID,
      isRevealed: true, // Island Raids are always public
      targetIsland,
      doubloonsOnChart: 0, // Starts at 0, grows during Pirate Phase
      notorietyReward: 4 // Always 4 notoriety
    };
  }

  /**
   * Create a Smuggler Route chart
   */
  static createSmugglerRoute(islandA: IslandName, islandB: IslandName): SmugglerRouteChart {
    return {
      id: this.generateId(),
      type: ChartType.SMUGGLER_ROUTE,
      isRevealed: false,
      islandA,
      islandB
    };
  }

  /**
   * Create all possible Smuggler Routes (10 total from 5 islands)
   */
  static createAllSmugglerRoutes(): SmugglerRouteChart[] {
    const islands: IslandName[] = ['Havana', 'Nassau', 'Tortuga', 'Port Royal', 'Hispaniola'];
    const routes: SmugglerRouteChart[] = [];

    // Generate all combinations of 2 islands
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        routes.push(this.createSmugglerRoute(islands[i], islands[j]));
      }
    }

    return routes;
  }

  /**
   * Reset the ID counter (useful for testing)
   */
  static resetIdCounter(): void {
    this.chartIdCounter = 0;
  }
}
