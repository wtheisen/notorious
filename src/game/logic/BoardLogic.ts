import { BoardState, HexState, Ship, hexToKey } from '../types/GameState';
import { HexCoord } from '../../types/CoordinateTypes';
import { Island } from '../../core/Island';
import { BOARD_HEXES, isOnBoard, getValidNeighbors } from '../../config/HexConstants';
import { areAdjacent, findPath, getDirection } from '../../utils/HexMath';
import { GAME_CONSTANTS, ShipType } from '../../types/GameTypes';

/**
 * Get a hex at specific coordinates
 */
export function getHex(board: BoardState, coord: HexCoord): HexState | null {
  return board.hexes[hexToKey(coord)] || null;
}

/**
 * Get all hexes on the board
 */
export function getAllHexes(board: BoardState): HexState[] {
  return Object.values(board.hexes);
}

/**
 * Get valid neighboring hexes (within board boundaries)
 */
export function getNeighbors(board: BoardState, coord: HexCoord): HexState[] {
  const neighborCoords = getValidNeighbors(coord);
  return neighborCoords
    .map(c => getHex(board, c))
    .filter((h): h is HexState => h !== null);
}

/**
 * Check if two hexes are adjacent
 */
export function isAdjacent(coord1: HexCoord, coord2: HexCoord): boolean {
  return areAdjacent(coord1, coord2) && isOnBoard(coord1) && isOnBoard(coord2);
}

/**
 * Check if sailing between two hexes is possible
 * Considers island impassable edges
 */
export function canSailBetween(board: BoardState, from: HexCoord, to: HexCoord): boolean {
  if (!isAdjacent(from, to)) {
    return false;
  }

  const fromHex = getHex(board, from);
  const toHex = getHex(board, to);

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
export function placeShip(board: BoardState, coord: HexCoord, ship: Ship): boolean {
  const hex = getHex(board, coord);
  if (!hex) return false;

  hex.ships.push(ship);
  return true;
}

/**
 * Remove a ship from the board
 * Returns true if the ship was found and removed
 */
export function removeShip(board: BoardState, coord: HexCoord, ship: Ship): boolean {
  const hex = getHex(board, coord);
  if (!hex) return false;

  const index = hex.ships.findIndex(s => s.type === ship.type && s.playerId === ship.playerId);
  if (index === -1) return false;

  hex.ships.splice(index, 1);
  return true;
}

/**
 * Move a ship from one hex to another
 * Returns true if successful
 */
export function moveShip(board: BoardState, from: HexCoord, to: HexCoord, ship: Ship): boolean {
  if (!canSailBetween(board, from, to)) {
    return false;
  }

  const fromHex = getHex(board, from);
  const toHex = getHex(board, to);

  if (!fromHex || !toHex) {
    return false;
  }

  // Remove from source
  if (!removeShip(board, from, ship)) {
    return false;
  }

  // Add to destination
  placeShip(board, to, ship);
  return true;
}

/**
 * Get all ships belonging to a specific player in a hex
 */
export function getPlayerShips(board: BoardState, coord: HexCoord, playerId: string): Ship[] {
  const hex = getHex(board, coord);
  if (!hex) return [];

  return hex.ships.filter(s => s.playerId === playerId);
}

/**
 * Calculate total influence for a player in a hex
 */
export function getInfluence(board: BoardState, coord: HexCoord, playerId: string): number {
  const ships = getPlayerShips(board, coord, playerId);
  return ships.reduce((total, ship) => total + GAME_CONSTANTS.INFLUENCE_VALUES[ship.type], 0);
}

/**
 * Get the player who controls a hex (most influence)
 * Returns null if no player has ships or if there's a tie
 */
export function getHexController(board: BoardState, coord: HexCoord): string | null {
  const hex = getHex(board, coord);
  if (!hex || hex.ships.length === 0) return null;

  const influences = new Map<string, number>();

  for (const ship of hex.ships) {
    const currentInfluence = influences.get(ship.playerId) || 0;
    influences.set(ship.playerId, currentInfluence + GAME_CONSTANTS.INFLUENCE_VALUES[ship.type]);
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
 * Find a path between two hexes
 * Considers island impassable edges and returns empty array if no path exists
 */
export function findPathOnBoard(board: BoardState, from: HexCoord, to: HexCoord): HexCoord[] {
  return findPath(
    from,
    to,
    (coord) => {
      // A hex is blocked if it's not on the board
      return !isOnBoard(coord);
    },
    (fromHex, toHex) => {
      // Check if we can sail between these two hexes (respects island edges)
      return canSailBetween(board, fromHex, toHex);
    }
  );
}

/**
 * Place an island on the board
 */
export function placeIsland(board: BoardState, island: Island): boolean {
  const hex = getHex(board, island.hexCoord);
  if (!hex) return false;

  hex.island = island;
  return true;
}

/**
 * Get an island at a specific hex
 */
export function getIslandAt(board: BoardState, coord: HexCoord): Island | null {
  const hex = getHex(board, coord);
  return hex?.island || null;
}

/**
 * Get all hexes controlled by a player
 */
export function getControlledHexes(board: BoardState, playerId: string): HexState[] {
  return getAllHexes(board).filter(hex => getHexController(board, hex.coord) === playerId);
}

/**
 * Count hexes controlled by a player
 */
export function countControlledHexes(board: BoardState, playerId: string): number {
  return getControlledHexes(board, playerId).length;
}

/**
 * Get all hexes containing ships from a specific player
 */
export function getHexesWithPlayerShips(board: BoardState, playerId: string): HexState[] {
  return getAllHexes(board).filter(hex => hex.ships.some(s => s.playerId === playerId));
}

/**
 * Check if a hex is empty (no ships)
 */
export function isHexEmpty(board: BoardState, coord: HexCoord): boolean {
  const hex = getHex(board, coord);
  return hex ? hex.ships.length === 0 : true;
}

/**
 * Check if a hex has an island
 */
export function hasIsland(board: BoardState, coord: HexCoord): boolean {
  const hex = getHex(board, coord);
  return hex?.island !== null && hex?.island !== undefined;
}

/**
 * Get all player IDs that have ships in a hex
 */
export function getPlayerIds(board: BoardState, coord: HexCoord): string[] {
  const hex = getHex(board, coord);
  if (!hex) return [];

  const playerIds = new Set<string>();
  for (const ship of hex.ships) {
    playerIds.add(ship.playerId);
  }
  return Array.from(playerIds);
}

/**
 * Create an empty board with all 19 hexes initialized
 */
export function createEmptyBoard(): BoardState {
  const hexes: Record<string, HexState> = {};

  for (const coord of BOARD_HEXES) {
    hexes[hexToKey(coord)] = {
      coord,
      ships: [],
      island: null
    };
  }

  return { hexes };
}

/**
 * Get all islands on the board
 */
export function getAllIslands(board: BoardState): Island[] {
  return getAllHexes(board)
    .filter(hex => hex.island !== null)
    .map(hex => hex.island as Island);
}

/**
 * Find an island by name
 */
export function getIslandByName(board: BoardState, name: string): Island | null {
  const islands = getAllIslands(board);
  return islands.find(i => i.name === name) || null;
}
