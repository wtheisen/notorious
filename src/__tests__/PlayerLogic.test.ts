import { describe, it, expect, beforeEach } from 'vitest';
import { ActionType, PlayerColor, PiratePower, GAME_CONSTANTS } from '../types/GameTypes';
import { PlayerState } from '../game/types/GameState';
import {
  placeCaptain,
  removeCaptain,
  hasUnplacedCaptains,
  resetCaptains,
  gainNotoriety,
  gainDoubloons,
  spendDoubloons,
  hasShips,
  spendShips,
  returnShips,
  hasPlayerWon,
  getFinalScore,
  setPortLocation,
  addChart,
  removeChart,
  hasChart,
  getCharts,
  getChartCount,
  hasAnyPlayerTriggeredEnd,
} from '../game/logic/PlayerLogic';
import { createHexCoord } from '../types/CoordinateTypes';
import { ChartFactory } from '../core/Chart';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: '0',
    name: 'Test Player',
    color: PlayerColor.BLUE,
    isAI: false,
    piratePower: PiratePower.THE_SAILOR,
    notoriety: 0,
    doubloons: 5,
    captainCount: 2,
    ships: { sloops: 4, galleons: 2 },
    portLocation: null,
    placedCaptains: [],
    charts: [],
    ...overrides,
  };
}

// ── Captain management ──

describe('captain management', () => {
  let player: PlayerState;

  beforeEach(() => {
    player = makePlayer();
  });

  it('placeCaptain succeeds within limit', () => {
    expect(placeCaptain(player, ActionType.SAIL)).toBe(true);
    expect(player.placedCaptains).toEqual([ActionType.SAIL]);
  });

  it('placeCaptain fails when all captains placed', () => {
    placeCaptain(player, ActionType.SAIL);
    placeCaptain(player, ActionType.BUILD);
    expect(placeCaptain(player, ActionType.STEAL)).toBe(false);
    expect(player.placedCaptains).toHaveLength(2);
  });

  it('removeCaptain pops the last captain', () => {
    placeCaptain(player, ActionType.SAIL);
    placeCaptain(player, ActionType.BUILD);
    expect(removeCaptain(player)).toBe(ActionType.BUILD);
    expect(player.placedCaptains).toHaveLength(1);
  });

  it('removeCaptain returns null when empty', () => {
    expect(removeCaptain(player)).toBeNull();
  });

  it('hasUnplacedCaptains is correct', () => {
    expect(hasUnplacedCaptains(player)).toBe(true);
    placeCaptain(player, ActionType.SAIL);
    expect(hasUnplacedCaptains(player)).toBe(true);
    placeCaptain(player, ActionType.BUILD);
    expect(hasUnplacedCaptains(player)).toBe(false);
  });

  it('resetCaptains clears placements', () => {
    placeCaptain(player, ActionType.SAIL);
    resetCaptains(player);
    expect(player.placedCaptains).toEqual([]);
    expect(hasUnplacedCaptains(player)).toBe(true);
  });
});

// ── Notoriety and captain unlocks ──

describe('gainNotoriety', () => {
  let player: PlayerState;

  beforeEach(() => {
    player = makePlayer();
  });

  it('adds notoriety', () => {
    gainNotoriety(player, 3);
    expect(player.notoriety).toBe(3);
  });

  it('unlocks 3rd captain at threshold 5', () => {
    gainNotoriety(player, 5);
    expect(player.captainCount).toBe(3);
  });

  it('unlocks 4th captain at threshold 12', () => {
    gainNotoriety(player, 12);
    expect(player.captainCount).toBe(4);
  });

  it('does not double-unlock on repeated gains past threshold', () => {
    gainNotoriety(player, 6);  // past 5
    expect(player.captainCount).toBe(3);
    gainNotoriety(player, 1);  // still past 5 but not yet 12
    expect(player.captainCount).toBe(3);
  });

  it('unlocks both thresholds in one jump', () => {
    gainNotoriety(player, 15); // past both 5 and 12
    expect(player.captainCount).toBe(4);
  });

  it('does not unlock if already past threshold', () => {
    player.notoriety = 10;
    player.captainCount = 3; // already have 3rd captain
    gainNotoriety(player, 1);
    expect(player.captainCount).toBe(3); // no new unlock
  });
});

// ── Doubloons ──

describe('doubloons', () => {
  let player: PlayerState;

  beforeEach(() => {
    player = makePlayer({ doubloons: 5 });
  });

  it('gainDoubloons adds', () => {
    gainDoubloons(player, 3);
    expect(player.doubloons).toBe(8);
  });

  it('spendDoubloons deducts', () => {
    expect(spendDoubloons(player, 3)).toBe(true);
    expect(player.doubloons).toBe(2);
  });

  it('spendDoubloons fails if not enough', () => {
    expect(spendDoubloons(player, 6)).toBe(false);
    expect(player.doubloons).toBe(5);
  });

  it('spendDoubloons allows spending all', () => {
    expect(spendDoubloons(player, 5)).toBe(true);
    expect(player.doubloons).toBe(0);
  });
});

// ── Ships ──

describe('ship management', () => {
  let player: PlayerState;

  beforeEach(() => {
    player = makePlayer({ ships: { sloops: 4, galleons: 2 } });
  });

  it('hasShips checks correctly', () => {
    expect(hasShips(player, 'sloops', 4)).toBe(true);
    expect(hasShips(player, 'sloops', 5)).toBe(false);
    expect(hasShips(player, 'galleons', 2)).toBe(true);
  });

  it('spendShips deducts', () => {
    expect(spendShips(player, 'sloops', 2)).toBe(true);
    expect(player.ships.sloops).toBe(2);
  });

  it('spendShips fails if not enough', () => {
    expect(spendShips(player, 'galleons', 3)).toBe(false);
    expect(player.ships.galleons).toBe(2);
  });

  it('returnShips adds back', () => {
    spendShips(player, 'sloops', 2);
    returnShips(player, 'sloops', 1);
    expect(player.ships.sloops).toBe(3);
  });
});

// ── Win condition ──

describe('win condition', () => {
  it('hasPlayerWon at 28 notoriety', () => {
    const player = makePlayer({ notoriety: GAME_CONSTANTS.WINNING_NOTORIETY });
    expect(hasPlayerWon(player)).toBe(true);
  });

  it('hasPlayerWon false below threshold', () => {
    const player = makePlayer({ notoriety: GAME_CONSTANTS.WINNING_NOTORIETY - 1 });
    expect(hasPlayerWon(player)).toBe(false);
  });

  it('getFinalScore = notoriety + doubloons', () => {
    const player = makePlayer({ notoriety: 10, doubloons: 5 });
    expect(getFinalScore(player)).toBe(15);
  });

  it('hasAnyPlayerTriggeredEnd checks all players', () => {
    const players = [
      makePlayer({ id: '0', notoriety: 10 }),
      makePlayer({ id: '1', notoriety: GAME_CONSTANTS.WINNING_NOTORIETY }),
    ];
    expect(hasAnyPlayerTriggeredEnd(players)).toBe(true);
  });

  it('hasAnyPlayerTriggeredEnd false when nobody reached threshold', () => {
    const players = [
      makePlayer({ id: '0', notoriety: 10 }),
      makePlayer({ id: '1', notoriety: 20 }),
    ];
    expect(hasAnyPlayerTriggeredEnd(players)).toBe(false);
  });
});

// ── Port location ──

describe('setPortLocation', () => {
  it('sets port location', () => {
    const player = makePlayer();
    setPortLocation(player, createHexCoord(1, -1));
    expect(player.portLocation).toEqual(createHexCoord(1, -1));
  });
});

// ── Charts ──

describe('chart management', () => {
  let player: PlayerState;

  beforeEach(() => {
    player = makePlayer();
    ChartFactory.resetIdCounter();
  });

  it('addChart adds to hand', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(0, 0));
    addChart(player, chart);
    expect(getChartCount(player)).toBe(1);
    expect(hasChart(player, chart.id)).toBe(true);
  });

  it('removeChart removes from hand', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(0, 0));
    addChart(player, chart);
    expect(removeChart(player, chart.id)).toBe(true);
    expect(getChartCount(player)).toBe(0);
  });

  it('removeChart returns false for missing chart', () => {
    expect(removeChart(player, 'nonexistent')).toBe(false);
  });

  it('getCharts returns a copy', () => {
    const chart = ChartFactory.createTreasureMap(createHexCoord(0, 0));
    addChart(player, chart);
    const charts = getCharts(player);
    charts.pop(); // modify the returned array
    expect(getChartCount(player)).toBe(1); // original untouched
  });
});
