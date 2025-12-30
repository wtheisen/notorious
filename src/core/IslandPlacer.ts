import { Board } from './Board';
import { Island } from './Island';
import { ChartFactory, TreasureMapChart } from './Chart';
import { ISLAND_DEFINITIONS } from '../config/IslandDefinitions';
import { BOARD_HEXES } from '../config/HexConstants';

/**
 * Handles random island placement on the board
 * Uses the board game's method: shuffle Treasure Maps, use first 5 to determine positions
 */
export class IslandPlacer {
  /**
   * Place 5 islands randomly on the board
   *
   * Algorithm (from board game rules):
   * 1. Create 19 Treasure Maps (one for each hex)
   * 2. Shuffle them
   * 3. Reveal first 5
   * 4. Place an island on each of the 5 indicated hexes
   * 5. Remove those 5 Treasure Maps from the deck
   * 6. Return remaining 14 Treasure Maps for the chart deck
   *
   * @param board The game board to place islands on
   * @returns Object containing placed islands and remaining Treasure Maps
   */
  placeIslands(board: Board): { islands: Island[]; remainingTreasureMaps: TreasureMapChart[] } {
    console.log('[IslandPlacer] Starting island placement');

    // 1. Create 19 Treasure Maps (one for each hex on the board)
    const allTreasureMaps = this.createAllTreasureMaps();
    console.log(`[IslandPlacer] Created ${allTreasureMaps.length} Treasure Maps`);

    // 2. Shuffle them
    this.shuffle(allTreasureMaps);
    console.log('[IslandPlacer] Shuffled Treasure Maps');

    // 3. Take first 5 for island placement
    const placementMaps = allTreasureMaps.slice(0, 5);
    console.log(`[IslandPlacer] Selected ${placementMaps.length} hexes for islands`);

    // 4. Shuffle island definitions to randomize which island goes where
    const shuffledIslandDefs = this.shuffle([...ISLAND_DEFINITIONS]);

    // 5. Create and place islands
    const islands: Island[] = [];
    for (let i = 0; i < 5; i++) {
      const map = placementMaps[i];
      const def = shuffledIslandDefs[i];

      const island = new Island(
        def.name,
        map.targetHex,
        def.impassableEdges,
        def.icon
      );

      board.placeIsland(island);
      islands.push(island);

      console.log(`[IslandPlacer] Placed ${island.name} at (${island.hexCoord.q}, ${island.hexCoord.r})`);
    }

    // 6. Return remaining 14 Treasure Maps (these go into the chart deck)
    const remainingTreasureMaps = allTreasureMaps.slice(5);
    console.log(`[IslandPlacer] Returning ${remainingTreasureMaps.length} Treasure Maps for deck`);

    return {
      islands,
      remainingTreasureMaps
    };
  }

  /**
   * Create 19 Treasure Map charts (one for each hex on the board)
   * @returns Array of Treasure Map charts
   */
  private createAllTreasureMaps(): TreasureMapChart[] {
    return BOARD_HEXES.map(hex => ChartFactory.createTreasureMap(hex));
  }

  /**
   * Fisher-Yates shuffle algorithm
   * Shuffles array in place and returns it
   * @param array Array to shuffle
   * @returns The shuffled array (same reference)
   */
  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * For testing: place islands at specific locations
   * @param board The game board
   * @param hexIndices Array of 5 indices into BOARD_HEXES
   * @returns Placed islands and remaining maps
   */
  placeIslandsAtPositions(
    board: Board,
    hexIndices: number[]
  ): { islands: Island[]; remainingTreasureMaps: TreasureMapChart[] } {
    if (hexIndices.length !== 5) {
      throw new Error('Must provide exactly 5 hex indices');
    }

    console.log('[IslandPlacer] Placing islands at specific positions:', hexIndices);

    const allTreasureMaps = this.createAllTreasureMaps();
    const islands: Island[] = [];

    for (let i = 0; i < 5; i++) {
      const hexIndex = hexIndices[i];
      if (hexIndex < 0 || hexIndex >= BOARD_HEXES.length) {
        throw new Error(`Invalid hex index: ${hexIndex}`);
      }

      const hex = BOARD_HEXES[hexIndex];
      const def = ISLAND_DEFINITIONS[i];

      const island = new Island(
        def.name,
        hex,
        def.impassableEdges,
        def.icon
      );

      board.placeIsland(island);
      islands.push(island);
    }

    // Remove the maps for the hexes where islands were placed
    const usedHexes = new Set(hexIndices.map(i => BOARD_HEXES[i]));
    const remainingTreasureMaps = allTreasureMaps.filter(
      map => !Array.from(usedHexes).some(
        hex => hex.q === map.targetHex.q && hex.r === map.targetHex.r
      )
    );

    return {
      islands,
      remainingTreasureMaps
    };
  }
}
