import { describe, it, expect } from 'vitest';
import { PlayerColor, PiratePower } from '../types/GameTypes';
import { PlayerState } from '../game/types/GameState';
import { gainNotoriety, hasPlayerWon } from '../game/logic/PlayerLogic';

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

// These tests validate that player.notoriety is correctly exposed on PlayerState,
// which is the value PlayerPanel reads to display the notoriety stat.
describe('PlayerPanel notoriety display data', () => {
  it('starts at zero', () => {
    const player = makePlayer();
    expect(player.notoriety).toBe(0);
  });

  it('reflects gains correctly', () => {
    const player = makePlayer();
    gainNotoriety(player, 5);
    expect(player.notoriety).toBe(5);
  });

  it('reflects mid-game notoriety', () => {
    const player = makePlayer({ notoriety: 14 });
    expect(player.notoriety).toBe(14);
  });

  it('reflects near-win notoriety', () => {
    const player = makePlayer({ notoriety: 27 });
    expect(player.notoriety).toBe(27);
    expect(hasPlayerWon(player)).toBe(false);
  });

  it('reflects winning notoriety', () => {
    const player = makePlayer({ notoriety: 28 });
    expect(player.notoriety).toBe(28);
    expect(hasPlayerWon(player)).toBe(true);
  });
});
