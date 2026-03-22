import { Island, createIsland } from './Island';
import { ChartFactory, TreasureMapChart } from './Chart';
import { ISLAND_DEFINITIONS } from '../config/IslandDefinitions';
import { BOARD_HEXES } from '../config/HexConstants';
import { HexCoord } from '../types/CoordinateTypes';

/** Minimal board interface for island placement (duck-typed) */
interface PlaceableBoard {
  placeIsland(island: Island): boolean | void;
}

/** A shuffle function that returns a new shuffled copy of the input array */
export type ShuffleFn = <T>(arr: T[]) => T[];

/**
 * Default (non-deterministic) Fisher-Yates shuffle.
 * Only used when no deterministic shuffle is provided (e.g. tests).
 */
function defaultShuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Handles random island placement on the board
 * Uses the board game's method: shuffle Treasure Maps, use first 5 to determine positions
 */
export class IslandPlacer {
  private shuffle: ShuffleFn;

  /**
   * @param shuffle Optional deterministic shuffle function (e.g. boardgame.io random.Shuffle).
   *               Falls back to Math.random if not provided.
   */
  constructor(shuffle?: ShuffleFn) {
    this.shuffle = shuffle ?? defaultShuffle;
  }

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
  placeIslands(board: PlaceableBoard): { islands: Island[]; remainingTreasureMaps: TreasureMapChart[] } {

    // 1. Create 19 Treasure Maps (one for each hex on the board)
    const allTreasureMaps = this.createAllTreasureMaps();

    // 2. Shuffle them
    const shuffledMaps = this.shuffle(allTreasureMaps);

    // 3. Take first 5 for island placement
    const placementMaps = shuffledMaps.slice(0, 5);

    // 4. Shuffle island definitions to randomize which island goes where
    const shuffledIslandDefs = this.shuffle([...ISLAND_DEFINITIONS]);

    // 5. Create and place islands
    const islands: Island[] = [];
    for (let i = 0; i < 5; i++) {
      const map = placementMaps[i];
      const def = shuffledIslandDefs[i];

      const island = createIsland(def.name, map.targetHex, def.impassableEdges, def.icon);

      board.placeIsland(island);
      islands.push(island);

    }

    // 6. Return remaining 14 Treasure Maps (these go into the chart deck)
    const remainingTreasureMaps = shuffledMaps.slice(5);

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
   * For testing: place islands at specific locations
   * @param board The game board
   * @param hexIndices Array of 5 indices into BOARD_HEXES
   * @returns Placed islands and remaining maps
   */
  placeIslandsAtPositions(
    board: PlaceableBoard,
    hexIndices: number[]
  ): { islands: Island[]; remainingTreasureMaps: TreasureMapChart[] } {
    if (hexIndices.length !== 5) {
      throw new Error('Must provide exactly 5 hex indices');
    }


    const allTreasureMaps = this.createAllTreasureMaps();
    const islands: Island[] = [];

    for (let i = 0; i < 5; i++) {
      const hexIndex = hexIndices[i];
      if (hexIndex < 0 || hexIndex >= BOARD_HEXES.length) {
        throw new Error(`Invalid hex index: ${hexIndex}`);
      }

      const hex = BOARD_HEXES[hexIndex];
      const def = ISLAND_DEFINITIONS[i];

      const island = createIsland(def.name, hex, def.impassableEdges, def.icon);

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
