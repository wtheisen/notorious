import React from 'react';
import { WindDirection, PlayerColor } from '../../types/GameTypes';
import { PlayerState } from '../../game/types/GameState';
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
  windDirection: WindDirection;
  instruction?: string;
}

export function PhaseIndicator({ phase, currentPlayer, windDirection, instruction }: PhaseIndicatorProps) {
  return (
    <div className="hud-panel phase-indicator" style={{ position: 'absolute', top: 14, left: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="phase-indicator__phase">{phase}</span>
        <span className="phase-indicator__wind" title={`Wind: ${windDirection}`}>
          {windDirection === WindDirection.CLOCKWISE ? '↻' : '↺'}
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
