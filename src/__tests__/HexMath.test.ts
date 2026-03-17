import { describe, it, expect } from 'vitest';
import { createHexCoord, hexEquals, hexToKey, keyToHex } from '../types/CoordinateTypes';
import {
  hexDistance,
  areAdjacent,
  getNeighbor,
  getAllNeighbors,
  getDirection,
  getHexesInRange,
  findPath,
} from '../utils/HexMath';
import { BOARD_HEXES, isOnBoard, getValidNeighbors, getWrappedNeighbor, isWrappedNeighbor } from '../config/HexConstants';

// ── Coordinate helpers ──

describe('createHexCoord', () => {
  it('computes s = -(q+r)', () => {
    const c = createHexCoord(2, -1);
    expect(c.s).toBe(-1);
  });

  it('q + r + s = 0', () => {
    const c = createHexCoord(3, -5);
    expect(c.q + c.r + c.s).toBe(0);
  });
});

describe('hexEquals', () => {
  it('equal coords', () => {
    expect(hexEquals(createHexCoord(1, 2), createHexCoord(1, 2))).toBe(true);
  });

  it('different coords', () => {
    expect(hexEquals(createHexCoord(1, 2), createHexCoord(2, 1))).toBe(false);
  });
});

describe('hexToKey / keyToHex', () => {
  it('round-trips', () => {
    const c = createHexCoord(2, -1);
    expect(hexEquals(keyToHex(hexToKey(c)), c)).toBe(true);
  });

  it('format is "q,r"', () => {
    expect(hexToKey(createHexCoord(2, -1))).toBe('2,-1');
  });
});

// ── Distance and adjacency ──

describe('hexDistance', () => {
  it('distance to self is 0', () => {
    const c = createHexCoord(0, 0);
    expect(hexDistance(c, c)).toBe(0);
  });

  it('adjacent hexes have distance 1', () => {
    expect(hexDistance(createHexCoord(0, 0), createHexCoord(1, 0))).toBe(1);
  });

  it('ring-2 hex has distance 2 from center', () => {
    expect(hexDistance(createHexCoord(0, 0), createHexCoord(2, 0))).toBe(2);
  });

  it('opposite corner hexes have distance 4', () => {
    expect(hexDistance(createHexCoord(2, -2), createHexCoord(-2, 2))).toBe(4);
  });
});

describe('areAdjacent', () => {
  it('true for neighbors', () => {
    expect(areAdjacent(createHexCoord(0, 0), createHexCoord(1, -1))).toBe(true);
  });

  it('false for non-neighbors', () => {
    expect(areAdjacent(createHexCoord(0, 0), createHexCoord(2, 0))).toBe(false);
  });
});

// ── Neighbors ──

describe('getNeighbor / getAllNeighbors', () => {
  it('getNeighbor direction 0 is East (+1,0)', () => {
    expect(hexEquals(getNeighbor(createHexCoord(0, 0), 0), createHexCoord(1, 0))).toBe(true);
  });

  it('getAllNeighbors returns 6', () => {
    expect(getAllNeighbors(createHexCoord(0, 0))).toHaveLength(6);
  });
});

describe('getDirection', () => {
  it('returns correct direction index', () => {
    // Direction 0 = East (+1, 0)
    expect(getDirection(createHexCoord(0, 0), createHexCoord(1, 0))).toBe(0);
    // Direction 3 = West (-1, 0)
    expect(getDirection(createHexCoord(0, 0), createHexCoord(-1, 0))).toBe(3);
  });

  it('returns -1 for non-adjacent', () => {
    expect(getDirection(createHexCoord(0, 0), createHexCoord(2, 0))).toBe(-1);
  });
});

// ── Board hex constants ──

describe('BOARD_HEXES', () => {
  it('has 19 hexes', () => {
    expect(BOARD_HEXES).toHaveLength(19);
  });

  it('center is on board', () => {
    expect(isOnBoard(createHexCoord(0, 0))).toBe(true);
  });

  it('off-board hex is not on board', () => {
    expect(isOnBoard(createHexCoord(3, 0))).toBe(false);
  });

  it('all hexes are within distance 2 of center', () => {
    for (const hex of BOARD_HEXES) {
      expect(hexDistance(hex, createHexCoord(0, 0))).toBeLessThanOrEqual(2);
    }
  });
});

// ── Edge wrapping ──

describe('edge wrapping', () => {
  it('outer hexes have wrapped neighbors', () => {
    const wrapped = getWrappedNeighbor(createHexCoord(2, 0), 0); // East from (2,0) → off-board
    expect(wrapped).not.toBeNull();
    expect(wrapped!.q).toBe(-2);
    expect(wrapped!.r == 0).toBe(true);
  });

  it('center hex has no wraps', () => {
    for (let d = 0; d < 6; d++) {
      expect(getWrappedNeighbor(createHexCoord(0, 0), d)).toBeNull();
    }
  });

  it('isWrappedNeighbor is symmetric', () => {
    expect(isWrappedNeighbor(createHexCoord(2, 0), createHexCoord(-2, 0))).toBe(true);
    expect(isWrappedNeighbor(createHexCoord(-2, 0), createHexCoord(2, 0))).toBe(true);
  });

  it('getValidNeighbors includes wraps for outer hexes', () => {
    const neighbors = getValidNeighbors(createHexCoord(2, 0));
    const keys = neighbors.map(n => hexToKey(n));
    expect(keys).toContain(hexToKey(createHexCoord(-2, 0)));
  });

  it('getValidNeighbors returns 6 for center', () => {
    expect(getValidNeighbors(createHexCoord(0, 0))).toHaveLength(6);
  });
});

// ── getHexesInRange ──

describe('getHexesInRange', () => {
  it('range 0 returns only center', () => {
    const hexes = getHexesInRange(createHexCoord(0, 0), 0);
    expect(hexes).toHaveLength(1);
  });

  it('range 1 returns 7 hexes (center + 6)', () => {
    expect(getHexesInRange(createHexCoord(0, 0), 1)).toHaveLength(7);
  });

  it('range 2 returns 19 hexes', () => {
    expect(getHexesInRange(createHexCoord(0, 0), 2)).toHaveLength(19);
  });
});

// ── findPath ──

describe('findPath', () => {
  const neverBlocked = () => false;

  it('finds direct path between neighbors', () => {
    const path = findPath(createHexCoord(0, 0), createHexCoord(1, 0), neverBlocked);
    expect(path).toHaveLength(2);
  });

  it('returns [start] for same start and end', () => {
    const path = findPath(createHexCoord(0, 0), createHexCoord(0, 0), neverBlocked);
    expect(path).toHaveLength(1);
  });

  it('returns empty if end is blocked', () => {
    const path = findPath(createHexCoord(0, 0), createHexCoord(1, 0), (c) => hexEquals(c, createHexCoord(1, 0)));
    expect(path).toHaveLength(0);
  });

  it('routes around blocked hex', () => {
    // Block (1,0) — path from (0,0) to (2,0) must go around
    const blocked = (c: { q: number; r: number }) => c.q === 1 && c.r === 0;
    const path = findPath(createHexCoord(0, 0), createHexCoord(2, 0), blocked);
    expect(path.length).toBeGreaterThan(3);
    // Ensure blocked hex is not in path
    expect(path.some(h => h.q === 1 && h.r === 0)).toBe(false);
  });
});
