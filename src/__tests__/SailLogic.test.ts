import { describe, it, expect, beforeEach } from 'vitest';
import { createHexCoord, hexToKey, EdgeDirection } from '../types/CoordinateTypes';
import { ShipType } from '../types/GameTypes';
import { createIsland } from '../core/Island';
import { BoardState } from '../game/types/GameState';
import { createEmptyBoard, placeIsland, placeShip } from '../game/logic/BoardLogic';
import { getReachableHexes } from '../game/logic/SailLogic';

let board: BoardState;

beforeEach(() => {
  board = createEmptyBoard();
});

describe('getReachableHexes', () => {
  it('returns all 6 neighbors at distance 1 from center', () => {
    const reachable = getReachableHexes(board, createHexCoord(0, 0), 1);
    expect(reachable.size).toBe(6);
    for (const dist of reachable.values()) {
      expect(dist).toBe(1);
    }
  });

  it('does not include the origin', () => {
    const reachable = getReachableHexes(board, createHexCoord(0, 0), 2);
    expect(reachable.has(hexToKey(createHexCoord(0, 0)))).toBe(false);
  });

  it('returns ring-1 and ring-2 hexes at maxSteps=2', () => {
    const reachable = getReachableHexes(board, createHexCoord(0, 0), 2);
    // All 18 other hexes should be reachable from center in 2 steps on open board
    expect(reachable.size).toBe(18);
  });

  it('distance values are correct', () => {
    const reachable = getReachableHexes(board, createHexCoord(0, 0), 2);
    // Direct neighbor at distance 1
    expect(reachable.get(hexToKey(createHexCoord(1, 0)))).toBe(1);
    // Two hops away at distance 2
    expect(reachable.get(hexToKey(createHexCoord(2, 0)))).toBe(2);
  });

  it('returns 0 hexes at maxSteps=0', () => {
    const reachable = getReachableHexes(board, createHexCoord(0, 0), 0);
    expect(reachable.size).toBe(0);
  });

  it('respects island impassable edges', () => {
    // Block all edges of center hex except NORTHWEST (dir 5 = SE in game labels)
    const island = createIsland('Fortress', createHexCoord(0, 0), [
      EdgeDirection.NORTH,      // 0
      EdgeDirection.NORTHEAST,  // 1
      EdgeDirection.SOUTHEAST,  // 2
      EdgeDirection.SOUTH,      // 3
      EdgeDirection.SOUTHWEST,  // 4
    ], '');
    placeIsland(board, island);

    const reachable = getReachableHexes(board, createHexCoord(0, 0), 1);
    // Only 1 direction unblocked
    expect(reachable.size).toBe(1);
  });

  it('reaches wrapped hexes from edge', () => {
    // From (2,0), should be able to reach (-2,0) via wrap in 1 step
    const reachable = getReachableHexes(board, createHexCoord(2, 0), 1);
    expect(reachable.has(hexToKey(createHexCoord(-2, 0)))).toBe(true);
  });

  it('custom sailCheck can override default', () => {
    // Block all sailing
    const blockAll = () => false;
    const reachable = getReachableHexes(board, createHexCoord(0, 0), 2, blockAll);
    expect(reachable.size).toBe(0);
  });

  it('custom sailCheck can allow everything', () => {
    const allowAll = () => true;
    const reachable = getReachableHexes(board, createHexCoord(0, 0), 1, allowAll);
    expect(reachable.size).toBe(6);
  });
});
