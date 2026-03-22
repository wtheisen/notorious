import React from 'react';
import { WindDirection, PlayerColor } from '../../types/GameTypes';
import { PlayerState, WindTokenState } from '../../game/types/GameState';
import './hud.css';

const COLOR_MAP: Record<string, string> = {
  [PlayerColor.BLUE]: 'var(--color-blue)',
  [PlayerColor.RED]: 'var(--color-red)',
  [PlayerColor.GREEN]: 'var(--color-green)',
  [PlayerColor.YELLOW]: 'var(--color-yellow)',
};

interface PhaseIndicatorProps {
  phase: string;
  currentPlayer: PlayerState;
  windToken: WindTokenState;
  players: PlayerState[];
  instruction?: string;
}

export function PhaseIndicator({ phase, currentPlayer, windToken, players, instruction }: PhaseIndicatorProps) {
  const placeDir = windToken.placeDirection;
  const p1 = windToken.position;
  const p2 = (windToken.position + 1) % players.length;
  const p1Name = players[p1]?.name ?? `P${p1 + 1}`;
  const p2Name = players[p2]?.name ?? `P${p2 + 1}`;

  return (
    <div className="hud-panel phase-indicator" style={{ position: 'absolute', top: 14, left: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="phase-indicator__phase">{phase}</span>
        <span className="phase-indicator__wind" title={`Wind between ${p1Name} and ${p2Name}`}>
          {placeDir === WindDirection.CLOCKWISE ? '↻' : '↺'}
        </span>
      </div>
      <div className="phase-indicator__player" style={{ color: COLOR_MAP[currentPlayer?.color] ?? '#fff' }}>
        {currentPlayer?.name ?? 'Unknown'}
      </div>
      {instruction && (
        <div className="phase-indicator__instruction">{instruction}</div>
      )}
    </div>
  );
}
