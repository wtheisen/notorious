import { describe, it, expect } from 'vitest';
import { createHexCoord, EdgeDirection } from '../types/CoordinateTypes';
import { createIsland, isEdgePassable, canSailInDirection } from '../core/Island';

describe('Island', () => {
  const island = createIsland(
    'Tortuga',
    createHexCoord(1, -1),
    [EdgeDirection.NORTH, EdgeDirection.SOUTHEAST],
    '🏝'
  );

  it('creates with correct properties', () => {
    expect(island.name).toBe('Tortuga');
    expect(island.hexCoord).toEqual(createHexCoord(1, -1));
    expect(island.icon).toBe('🏝');
    expect(island.impassableEdges).toHaveLength(2);
  });

  it('isEdgePassable returns false for blocked edges', () => {
    expect(isEdgePassable(island, EdgeDirection.NORTH)).toBe(false);
    expect(isEdgePassable(island, EdgeDirection.SOUTHEAST)).toBe(false);
  });

  it('isEdgePassable returns true for open edges', () => {
    expect(isEdgePassable(island, EdgeDirection.NORTHEAST)).toBe(true);
    expect(isEdgePassable(island, EdgeDirection.SOUTH)).toBe(true);
    expect(isEdgePassable(island, EdgeDirection.SOUTHWEST)).toBe(true);
    expect(isEdgePassable(island, EdgeDirection.NORTHWEST)).toBe(true);
  });

  it('canSailInDirection matches isEdgePassable', () => {
    for (let d = 0; d < 6; d++) {
      expect(canSailInDirection(island, d)).toBe(isEdgePassable(island, d));
    }
  });

  it('island with no impassable edges is fully passable', () => {
    const openIsland = createIsland('Open', createHexCoord(0, 0), [], '');
    for (let d = 0; d < 6; d++) {
      expect(isEdgePassable(openIsland, d)).toBe(true);
    }
  });

  it('island with all edges blocked is fully impassable', () => {
    const fortress = createIsland('Fortress', createHexCoord(0, 0), [0, 1, 2, 3, 4, 5], '');
    for (let d = 0; d < 6; d++) {
      expect(isEdgePassable(fortress, d)).toBe(false);
    }
  });
});
