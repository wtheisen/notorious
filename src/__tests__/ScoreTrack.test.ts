import { describe, it, expect } from 'vitest';

// The stack offset formula from ScoreTrack.tsx:
// (stackIdx - (group.length - 1) / 2) * 18
function computeStackOffset(stackIdx: number, groupLength: number): number {
  return groupLength > 1
    ? (stackIdx - (groupLength - 1) / 2) * 18
    : 0;
}

describe('ScoreTrack cube stack offset', () => {
  it('returns 0 for a single player at a notoriety value', () => {
    expect(computeStackOffset(0, 1)).toBe(0);
  });

  it('spreads two players symmetrically with 18px gap', () => {
    const offsets = [computeStackOffset(0, 2), computeStackOffset(1, 2)];
    expect(offsets).toEqual([-9, 9]);
    // gap between adjacent cubes: 18px > 16px cube height → no overlap
    expect(offsets[1] - offsets[0]).toBe(18);
  });

  it('spreads three players symmetrically with 18px gaps', () => {
    const offsets = [0, 1, 2].map(i => computeStackOffset(i, 3));
    expect(offsets).toEqual([-18, 0, 18]);
    expect(offsets[1] - offsets[0]).toBe(18);
    expect(offsets[2] - offsets[1]).toBe(18);
  });

  it('spreads four players symmetrically with 18px gaps', () => {
    const offsets = [0, 1, 2, 3].map(i => computeStackOffset(i, 4));
    expect(offsets).toEqual([-27, -9, 9, 27]);
    expect(offsets[1] - offsets[0]).toBe(18);
    expect(offsets[2] - offsets[1]).toBe(18);
    expect(offsets[3] - offsets[2]).toBe(18);
  });

  it('centers the group (sum of offsets is always 0)', () => {
    for (const n of [1, 2, 3, 4]) {
      const sum = Array.from({ length: n }, (_, i) => computeStackOffset(i, n))
        .reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(0);
    }
  });

  it('adjacent cubes never overlap (gap >= 16px cube size)', () => {
    for (const n of [2, 3, 4]) {
      for (let i = 0; i < n - 1; i++) {
        const gap = computeStackOffset(i + 1, n) - computeStackOffset(i, n);
        expect(gap).toBeGreaterThanOrEqual(16);
      }
    }
  });
});
