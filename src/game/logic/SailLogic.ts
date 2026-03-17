import { BoardState } from '../types/GameState';
import { HexCoord, hexToKey } from '../../types/CoordinateTypes';
import { canSailBetween } from './BoardLogic';
import { getValidNeighbors } from '../../config/HexConstants';

/** Function that checks if sailing between two adjacent hexes is allowed */
export type SailCheckFn = (board: BoardState, from: HexCoord, to: HexCoord) => boolean;

/**
 * Find all hexes reachable from `origin` within `maxSteps` moves.
 * Uses `sailCheck` for edge traversal (defaults to canSailBetween).
 * Pass a power-aware check for The Islander who ignores island edges.
 */
export function getReachableHexes(
  board: BoardState,
  origin: HexCoord,
  maxSteps: number,
  sailCheck: SailCheckFn = canSailBetween
): Map<string, number> {
  const reachable = new Map<string, number>();
  const originKey = hexToKey(origin);
  reachable.set(originKey, 0);

  const queue: { coord: HexCoord; dist: number }[] = [{ coord: origin, dist: 0 }];

  while (queue.length > 0) {
    const { coord, dist } = queue.shift()!;
    if (dist >= maxSteps) continue;

    const neighbors = getValidNeighbors(coord);
    for (const neighbor of neighbors) {
      const key = hexToKey(neighbor);
      if (reachable.has(key)) continue;
      if (!sailCheck(board, coord, neighbor)) continue;

      reachable.set(key, dist + 1);
      queue.push({ coord: neighbor, dist: dist + 1 });
    }
  }

  reachable.delete(originKey);
  return reachable;
}
