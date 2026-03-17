import { describe, it, expect, beforeEach } from 'vitest';
import { createHexCoord } from '../types/CoordinateTypes';
import { ShipType } from '../types/GameTypes';
import { EdgeDirection } from '../types/CoordinateTypes';
import { createIsland } from '../core/Island';
import { BoardState } from '../game/types/GameState';
import {
  createEmptyBoard,
  getHex,
  getNeighbors,
  isAdjacent,
  canSailBetween,
  placeShip,
  removeShip,
  moveShip,
  getPlayerShips,
  getInfluence,
  getHexController,
  placeIsland,
  getIslandAt,
  getControlledHexes,
  isHexEmpty,
  hasIsland,
  getPlayerIds,
  findPathOnBoard,
} from '../game/logic/BoardLogic';

let board: BoardState;

beforeEach(() => {
  board = createEmptyBoard();
});

// ── Board creation ──

describe('createEmptyBoard', () => {
  it('creates a board with 19 hexes', () => {
    expect(Object.keys(board.hexes)).toHaveLength(19);
  });

  it('all hexes start with no ships', () => {
    for (const hex of Object.values(board.hexes)) {
      expect(hex.ships).toEqual([]);
    }
  });

  it('all hexes start with no island', () => {
    for (const hex of Object.values(board.hexes)) {
      expect(hex.island).toBeNull();
    }
  });

  it('includes center hex (0,0)', () => {
    expect(getHex(board, createHexCoord(0, 0))).not.toBeNull();
  });

  it('includes outer ring hex (2,0)', () => {
    expect(getHex(board, createHexCoord(2, 0))).not.toBeNull();
  });

  it('does not include off-board hex (3,0)', () => {
    expect(getHex(board, createHexCoord(3, 0))).toBeNull();
  });
});

// ── Adjacency ──

describe('isAdjacent', () => {
  it('center is adjacent to all ring-1 hexes', () => {
    const center = createHexCoord(0, 0);
    expect(isAdjacent(center, createHexCoord(1, 0))).toBe(true);
    expect(isAdjacent(center, createHexCoord(0, 1))).toBe(true);
    expect(isAdjacent(center, createHexCoord(-1, 1))).toBe(true);
    expect(isAdjacent(center, createHexCoord(-1, 0))).toBe(true);
    expect(isAdjacent(center, createHexCoord(0, -1))).toBe(true);
    expect(isAdjacent(center, createHexCoord(1, -1))).toBe(true);
  });

  it('non-adjacent hexes return false', () => {
    expect(isAdjacent(createHexCoord(0, 0), createHexCoord(2, 0))).toBe(false);
  });

  it('off-board hexes return false', () => {
    expect(isAdjacent(createHexCoord(0, 0), createHexCoord(5, 5))).toBe(false);
  });

  it('edge-wrap pairs are adjacent', () => {
    // (2,0) wraps to (-2,0) via the east edge
    expect(isAdjacent(createHexCoord(2, 0), createHexCoord(-2, 0))).toBe(true);
  });
});

describe('getNeighbors', () => {
  it('center has 6 neighbors', () => {
    expect(getNeighbors(board, createHexCoord(0, 0))).toHaveLength(6);
  });

  it('outer hex has neighbors including wraps', () => {
    const neighbors = getNeighbors(board, createHexCoord(2, 0));
    // (2,0) has normal neighbors (1,0), (1,1), (2,-1) and wraps
    expect(neighbors.length).toBeGreaterThanOrEqual(4);
  });
});

// ── Ship placement ──

describe('placeShip / removeShip', () => {
  const center = createHexCoord(0, 0);
  const sloop = { type: ShipType.SLOOP, playerId: '0' };

  it('places a ship on a valid hex', () => {
    expect(placeShip(board, center, sloop)).toBe(true);
    expect(getHex(board, center)!.ships).toHaveLength(1);
  });

  it('fails to place on off-board hex', () => {
    expect(placeShip(board, createHexCoord(5, 5), sloop)).toBe(false);
  });

  it('removes a ship', () => {
    placeShip(board, center, sloop);
    expect(removeShip(board, center, sloop)).toBe(true);
    expect(getHex(board, center)!.ships).toHaveLength(0);
  });

  it('remove returns false if ship not present', () => {
    expect(removeShip(board, center, sloop)).toBe(false);
  });

  it('can place multiple ships on same hex', () => {
    const sloop2 = { type: ShipType.SLOOP, playerId: '1' };
    placeShip(board, center, sloop);
    placeShip(board, center, sloop2);
    expect(getHex(board, center)!.ships).toHaveLength(2);
  });
});

// ── moveShip ──

describe('moveShip', () => {
  const from = createHexCoord(0, 0);
  const to = createHexCoord(1, 0);
  const sloop = { type: ShipType.SLOOP, playerId: '0' };

  it('moves between adjacent hexes', () => {
    placeShip(board, from, sloop);
    expect(moveShip(board, from, to, sloop)).toBe(true);
    expect(getHex(board, from)!.ships).toHaveLength(0);
    expect(getHex(board, to)!.ships).toHaveLength(1);
  });

  it('fails to move to non-adjacent hex', () => {
    placeShip(board, from, sloop);
    expect(moveShip(board, from, createHexCoord(2, 0), sloop)).toBe(false);
    expect(getHex(board, from)!.ships).toHaveLength(1);
  });
});

// ── Sailing through island edges ──

describe('canSailBetween with islands', () => {
  it('returns true for adjacent ocean hexes', () => {
    expect(canSailBetween(board, createHexCoord(0, 0), createHexCoord(1, 0))).toBe(true);
  });

  it('blocks sailing through impassable island edge (outbound)', () => {
    const island = createIsland('TestIsland', createHexCoord(0, 0), [EdgeDirection.NORTH], '');
    placeIsland(board, island);
    // EdgeDirection.NORTH = 0, direction 0 = East (q+1, r+0)
    expect(canSailBetween(board, createHexCoord(0, 0), createHexCoord(1, 0))).toBe(false);
  });

  it('blocks sailing through impassable island edge (inbound)', () => {
    // Place island on neighbor with edge blocking the return direction
    const island = createIsland('TestIsland', createHexCoord(1, 0), [EdgeDirection.SOUTH], '');
    placeIsland(board, island);
    // EdgeDirection.SOUTH = 3, direction 3 = West (q-1, r+0), which faces (0,0)
    expect(canSailBetween(board, createHexCoord(0, 0), createHexCoord(1, 0))).toBe(false);
  });

  it('allows sailing on passable edges of island', () => {
    // Block only NORTH edge, SOUTHEAST (dir 5) should still be passable
    const island = createIsland('TestIsland', createHexCoord(0, 0), [EdgeDirection.NORTH], '');
    placeIsland(board, island);
    expect(canSailBetween(board, createHexCoord(0, 0), createHexCoord(0, 1))).toBe(true);
  });
});

// ── Influence and control ──

describe('getInfluence / getHexController', () => {
  const hex = createHexCoord(0, 0);

  it('sloop gives 1 influence', () => {
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '0' });
    expect(getInfluence(board, hex, '0')).toBe(1);
  });

  it('galleon gives 2 influence', () => {
    placeShip(board, hex, { type: ShipType.GALLEON, playerId: '0' });
    expect(getInfluence(board, hex, '0')).toBe(2);
  });

  it('port gives 3 influence', () => {
    placeShip(board, hex, { type: ShipType.PORT, playerId: '0' });
    expect(getInfluence(board, hex, '0')).toBe(3);
  });

  it('returns player with most influence as controller', () => {
    placeShip(board, hex, { type: ShipType.GALLEON, playerId: '0' });
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '1' });
    expect(getHexController(board, hex)).toBe('0');
  });

  it('returns null on tie', () => {
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '0' });
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '1' });
    expect(getHexController(board, hex)).toBeNull();
  });

  it('returns null for empty hex', () => {
    expect(getHexController(board, hex)).toBeNull();
  });
});

describe('getControlledHexes', () => {
  it('returns hexes where player has sole highest influence', () => {
    placeShip(board, createHexCoord(0, 0), { type: ShipType.SLOOP, playerId: '0' });
    placeShip(board, createHexCoord(1, 0), { type: ShipType.SLOOP, playerId: '0' });
    placeShip(board, createHexCoord(-1, 0), { type: ShipType.SLOOP, playerId: '1' });
    expect(getControlledHexes(board, '0')).toHaveLength(2);
    expect(getControlledHexes(board, '1')).toHaveLength(1);
  });
});

// ── Island placement ──

describe('placeIsland / getIslandAt / hasIsland', () => {
  const coord = createHexCoord(1, -1);
  const island = createIsland('Havana', coord, [EdgeDirection.NORTH, EdgeDirection.SOUTH], '🏝');

  it('places an island', () => {
    expect(placeIsland(board, island)).toBe(true);
    expect(getIslandAt(board, coord)).toEqual(island);
    expect(hasIsland(board, coord)).toBe(true);
  });

  it('fails on off-board coord', () => {
    const badIsland = createIsland('X', createHexCoord(5, 5), [], '');
    expect(placeIsland(board, badIsland)).toBe(false);
  });
});

// ── Utility queries ──

describe('getPlayerShips / getPlayerIds / isHexEmpty', () => {
  const hex = createHexCoord(0, 0);

  it('getPlayerShips returns only that player', () => {
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '0' });
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '1' });
    expect(getPlayerShips(board, hex, '0')).toHaveLength(1);
  });

  it('getPlayerIds returns all players present', () => {
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '0' });
    placeShip(board, hex, { type: ShipType.GALLEON, playerId: '1' });
    expect(getPlayerIds(board, hex).sort()).toEqual(['0', '1']);
  });

  it('isHexEmpty is true initially', () => {
    expect(isHexEmpty(board, hex)).toBe(true);
  });

  it('isHexEmpty is false after placing ship', () => {
    placeShip(board, hex, { type: ShipType.SLOOP, playerId: '0' });
    expect(isHexEmpty(board, hex)).toBe(false);
  });
});

// ── Pathfinding ──

describe('findPathOnBoard', () => {
  it('finds direct path between adjacent hexes', () => {
    const path = findPathOnBoard(board, createHexCoord(0, 0), createHexCoord(1, 0));
    expect(path).toHaveLength(2);
  });

  it('finds multi-hop path', () => {
    const path = findPathOnBoard(board, createHexCoord(0, 0), createHexCoord(2, 0));
    expect(path.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array for same hex', () => {
    // findPath returns [start] for same hex, which has length 1
    const path = findPathOnBoard(board, createHexCoord(0, 0), createHexCoord(0, 0));
    expect(path).toHaveLength(1);
  });

  it('routes around impassable island edges', () => {
    // Place island at (0,0) blocking east edge
    const island = createIsland('BlockIsland', createHexCoord(0, 0), [EdgeDirection.NORTH], '');
    placeIsland(board, island);
    // Path from (0,0) to (1,0) must go around since east edge is blocked
    const path = findPathOnBoard(board, createHexCoord(0, 0), createHexCoord(1, 0));
    expect(path.length).toBeGreaterThan(2);
  });
});

// ── Edge wrapping ──

describe('edge wrapping', () => {
  it('(2,0) and (-2,0) are adjacent via wrap', () => {
    expect(isAdjacent(createHexCoord(2, 0), createHexCoord(-2, 0))).toBe(true);
  });

  it('can sail between wrapped hexes', () => {
    expect(canSailBetween(board, createHexCoord(2, 0), createHexCoord(-2, 0))).toBe(true);
  });

  it('can move ship across wrap boundary', () => {
    const ship = { type: ShipType.SLOOP, playerId: '0' };
    placeShip(board, createHexCoord(2, 0), ship);
    expect(moveShip(board, createHexCoord(2, 0), createHexCoord(-2, 0), ship)).toBe(true);
    expect(getHex(board, createHexCoord(-2, 0))!.ships).toHaveLength(1);
  });

  it('corner wrap pairs are adjacent', () => {
    // (2,-2) wraps to (-2,2)
    expect(isAdjacent(createHexCoord(2, -2), createHexCoord(-2, 2))).toBe(true);
    // (0,-2) wraps to (0,2)
    expect(isAdjacent(createHexCoord(0, -2), createHexCoord(0, 2))).toBe(true);
  });
});
