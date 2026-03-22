import { describe, it, expect } from 'vitest';
import { getInstruction } from '../ui/hooks/useInteractionMode';
import { ActionType } from '../types/GameTypes';

function makePlayer(placedCaptains: ActionType[] = []) {
  return {
    id: '0',
    name: 'Player 1',
    portLocation: null,
    placedCaptains,
    captainCount: 2,
    doubloons: 5,
    notoriety: 0,
    piratePower: 'Sailor' as const,
    ships: { sloops: 5, galleons: 2, ports: 0 },
    charts: [],
  };
}

describe('getInstruction — idle case', () => {
  it('shows sail hint when player has a SAIL captain in play phase', () => {
    const result = getInstruction(
      { type: 'idle' },
      'play',
      makePlayer([ActionType.SAIL]),
      null,
    );
    expect(result).toBe('Choose an action, or drag a ship to sail');
  });

  it('omits sail hint when player has non-SAIL captains only', () => {
    const result = getInstruction(
      { type: 'idle' },
      'play',
      makePlayer([ActionType.BUILD, ActionType.CHART]),
      null,
    );
    expect(result).toBe('Choose an action to execute');
  });

  it('returns empty string when player has no captains remaining', () => {
    const result = getInstruction(
      { type: 'idle' },
      'play',
      makePlayer([]),
      null,
    );
    expect(result).toBe('');
  });

  it('returns empty string outside play phase even with captains', () => {
    const result = getInstruction(
      { type: 'idle' },
      'place',
      makePlayer([ActionType.SAIL]),
      null,
    );
    expect(result).toBe('');
  });

  it('shows sail hint when SAIL is mixed with other captains', () => {
    const result = getInstruction(
      { type: 'idle' },
      'play',
      makePlayer([ActionType.BUILD, ActionType.SAIL]),
      null,
    );
    expect(result).toBe('Choose an action, or drag a ship to sail');
  });
});
