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

  return (
    <div className="hud-panel phase-indicator" style={{ position: 'absolute', top: 14, left: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="phase-indicator__phase">{phase}</span>
        <span className="phase-indicator__wind" title={`Wind: PLACE ${placeDir}, between P${p1}–P${p2}`}>
          {placeDir === WindDirection.CLOCKWISE ? '↻' : '↺'}
          <span style={{ fontSize: '0.6rem', marginLeft: 4, opacity: 0.7 }}>{p1}–{p2}</span>
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
