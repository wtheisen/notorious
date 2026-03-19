import { describe, it, expect } from 'vitest';
import { createHexCoord } from '../types/CoordinateTypes';
import { boardDistance } from '../game/logic/BoardLogic';
import { getValidNeighbors, isWrappedNeighbor } from '../config/HexConstants';
import { ShipType, ActionType, ChartType, GAME_CONSTANTS } from '../types/GameTypes';
import { enumerateMoves } from '../game/ai/NotoriousBot';
import { hexToKey } from '../game/types/GameState';

// Minimal state factory for AI tests
function makeMinimalState(overrides: any = {}) {
  const hexes: Record<string, any> = {};
  // Create all 19 board hexes
  const boardCoords = [
    [0,0],[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1],
    [0,-2],[1,-2],[2,-2],[2,-1],[2,0],[1,1],[0,2],[-1,2],[-2,2],[-2,1],[-2,0],[-1,-1]
  ];
  for (const [q, r] of boardCoords) {
    const coord = createHexCoord(q, r);
    hexes[hexToKey(coord)] = { coord, ships: [], island: null };
  }
  Object.assign(hexes, overrides.hexOverrides || {});

  return {
    board: { hexes },
    players: overrides.players || [
      makePlayer('0'), makePlayer('1'), makePlayer('2'), makePlayer('3')
    ],
    windToken: overrides.windToken || { holder: null, position: 0, placeDirection: 'clockwise' },
    chartDeck: overrides.chartDeck || { drawPile: [], discardPile: [], islandRaids: [], hiddenIslandRaids: [] },
    piratePhaseTurnsComplete: 0,
    gameEndTriggered: false,
    ...(overrides.extra || {})
  };
}

function makePlayer(id: string, overrides: any = {}) {
  return {
    id,
    name: `Player ${parseInt(id) + 1}`,
    portLocation: null,
    placedCaptains: [],
    captainCount: 2,
    doubloons: 5,
    notoriety: 0,
    piratePower: 'Sailor',
    ships: { sloops: 5, galleons: 2, ports: 0 },
    charts: [],
    ...overrides
  };
}

function makeCtx(phase: string, currentPlayer: string = '1') {
  return { phase, currentPlayer, numPlayers: 4 };
}

describe('Bug Fix #4: boardDistance handles edge wrapping', () => {
  it('returns 1 for directly adjacent hexes', () => {
    const a = createHexCoord(0, 0);
    const b = createHexCoord(1, 0);
    expect(boardDistance(a, b)).toBe(1);
  });

  it('returns 2 for two-step hexes', () => {
    const a = createHexCoord(0, 0);
    const b = createHexCoord(2, 0);
    expect(boardDistance(a, b)).toBe(2);
  });

  it('returns 0 for same hex', () => {
    const a = createHexCoord(0, 0);
    expect(boardDistance(a, a)).toBe(0);
  });

  it('returns 1 for wrapped neighbors (opposite edge hexes)', () => {
    // (2,0) wraps to (-2,0) via the wrap table
    const a = createHexCoord(2, 0);
    const b = createHexCoord(-2, 0);
    // Verify they are actually wrapped neighbors first
    expect(isWrappedNeighbor(a, b)).toBe(true);
    expect(boardDistance(a, b)).toBe(1);
  });

  it('returns 1 for another wrapped pair', () => {
    const a = createHexCoord(0, -2);
    const b = createHexCoord(0, 2);
    expect(isWrappedNeighbor(a, b)).toBe(true);
    expect(boardDistance(a, b)).toBe(1);
  });

  it('returns 2 for hex one step from a wrap target', () => {
    // (2,0) wraps to (-2,0), so (1,0) -> (-2,0) should be 2
    const a = createHexCoord(1, 0);
    const b = createHexCoord(-2, 0);
    expect(boardDistance(a, b)).toBe(2);
  });

  it('returns Infinity when maxDepth is too small', () => {
    const a = createHexCoord(0, 0);
    const b = createHexCoord(2, 0);
    expect(boardDistance(a, b, 1)).toBe(Infinity);
  });
});

describe('Bug Fix #2: AI does not try to sail PORT ships', () => {
  it('generateSailMoves excludes PORT ships', () => {
    const portCoord = createHexCoord(0, 0);
    const state = makeMinimalState({
      hexOverrides: {
        [hexToKey(portCoord)]: {
          coord: portCoord,
          ships: [
            { type: ShipType.PORT, playerId: '1' },
            { type: ShipType.SLOOP, playerId: '1' }
          ],
          island: null
        }
      },
      players: [
        makePlayer('0'),
        makePlayer('1', { placedCaptains: [ActionType.SAIL], portLocation: portCoord }),
        makePlayer('2'),
        makePlayer('3')
      ]
    });

    const ctx = makeCtx('play', '1');
    const moves = enumerateMoves(state as any, ctx);

    // All sail moves should be for SLOOP, none for PORT
    const sailMoves = moves.filter(m => m.move === 'sail');
    expect(sailMoves.length).toBeGreaterThan(0);
    for (const m of sailMoves) {
      expect(m.args[0].moves[0].shipType).not.toBe(ShipType.PORT);
    }
  });
});

describe('Bug Fix #3: AI uses wrap-aware neighbors', () => {
  it('generates sail moves across wrap boundaries', () => {
    const edgeCoord = createHexCoord(2, 0);
    const state = makeMinimalState({
      hexOverrides: {
        [hexToKey(edgeCoord)]: {
          coord: edgeCoord,
          ships: [{ type: ShipType.SLOOP, playerId: '1' }],
          island: null
        }
      },
      players: [
        makePlayer('0'),
        makePlayer('1', { placedCaptains: [ActionType.SAIL] }),
        makePlayer('2'),
        makePlayer('3')
      ]
    });

    const ctx = makeCtx('play', '1');
    const moves = enumerateMoves(state as any, ctx);

    const sailMoves = moves.filter(m => m.move === 'sail');
    const destinations = sailMoves.map(m => m.args[0].moves[0].to);

    // Should include the wrapped neighbor (-2, 0)
    const hasWrapped = destinations.some(
      (d: any) => d.q === -2 && d.r === 0
    );
    expect(hasWrapped).toBe(true);
  });
});

describe('Bug Fix #5: AI does not try to sink PORT ships', () => {
  it('generateSinkMoves excludes PORT ships as targets', () => {
    const sharedHex = createHexCoord(1, 0);
    const state = makeMinimalState({
      hexOverrides: {
        [hexToKey(sharedHex)]: {
          coord: sharedHex,
          ships: [
            { type: ShipType.SLOOP, playerId: '1' },
            { type: ShipType.PORT, playerId: '2' },
          ],
          island: null
        }
      },
      players: [
        makePlayer('0'),
        makePlayer('1', { placedCaptains: [ActionType.SINK] }),
        makePlayer('2', { portLocation: sharedHex }),
        makePlayer('3')
      ]
    });

    const ctx = makeCtx('play', '1');
    const moves = enumerateMoves(state as any, ctx);

    const sinkMoves = moves.filter(m => m.move === 'sink');
    // No valid sink targets — only enemy ship is a PORT
    expect(sinkMoves.length).toBe(0);
  });

  it('generateSinkMoves still targets non-PORT enemy ships', () => {
    const sharedHex = createHexCoord(1, 0);
    const state = makeMinimalState({
      hexOverrides: {
        [hexToKey(sharedHex)]: {
          coord: sharedHex,
          ships: [
            { type: ShipType.SLOOP, playerId: '1' },
            { type: ShipType.PORT, playerId: '2' },
            { type: ShipType.SLOOP, playerId: '2' },
          ],
          island: null
        }
      },
      players: [
        makePlayer('0'),
        makePlayer('1', { placedCaptains: [ActionType.SINK] }),
        makePlayer('2', { portLocation: sharedHex }),
        makePlayer('3')
      ]
    });

    const ctx = makeCtx('play', '1');
    const moves = enumerateMoves(state as any, ctx);

    const sinkMoves = moves.filter(m => m.move === 'sink');
    expect(sinkMoves.length).toBe(1);
    expect(sinkMoves[0].args[0].targetShipType).toBe(ShipType.SLOOP);
  });
});

describe('Bug Fix #1: AI claims charts during Pirate phase', () => {
  it('enumerates claimChart for a claimable Treasure Map', () => {
    const targetHex = createHexCoord(1, 0);
    const chart = {
      id: 'tm-1',
      type: ChartType.TREASURE_MAP,
      targetHex,
      notorietyReward: 0,
      doubloonReward: 4
    };

    const state = makeMinimalState({
      hexOverrides: {
        [hexToKey(targetHex)]: {
          coord: targetHex,
          ships: [
            { type: ShipType.GALLEON, playerId: '1' },
            { type: ShipType.SLOOP, playerId: '1' }
          ],
          island: null
        }
      },
      players: [
        makePlayer('0'),
        makePlayer('1', { charts: [chart] }),
        makePlayer('2'),
        makePlayer('3')
      ]
    });

    const ctx = makeCtx('pirate', '1');
    const moves = enumerateMoves(state as any, ctx);

    const claimMoves = moves.filter(m => m.move === 'claimChart');
    expect(claimMoves.length).toBe(1);
    expect(claimMoves[0].args[0].chartId).toBe('tm-1');
  });

  it('does not enumerate claimChart when conditions are not met', () => {
    const targetHex = createHexCoord(1, 0);
    const chart = {
      id: 'tm-2',
      type: ChartType.TREASURE_MAP,
      targetHex,
      notorietyReward: 0,
      doubloonReward: 4
    };

    // No galleon at target hex
    const state = makeMinimalState({
      players: [
        makePlayer('0'),
        makePlayer('1', { charts: [chart] }),
        makePlayer('2'),
        makePlayer('3')
      ]
    });

    const ctx = makeCtx('pirate', '1');
    const moves = enumerateMoves(state as any, ctx);

    const claimMoves = moves.filter(m => m.move === 'claimChart');
    expect(claimMoves.length).toBe(0);
  });

  it('always includes doneClaiming in pirate phase', () => {
    const state = makeMinimalState();
    const ctx = makeCtx('pirate', '1');
    const moves = enumerateMoves(state as any, ctx);

    expect(moves.some(m => m.move === 'doneClaiming')).toBe(true);
  });
});
