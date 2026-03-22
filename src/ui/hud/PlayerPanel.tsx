import React, { useState } from 'react';
import { PlayerState } from '../../game/types/GameState';
import { PlayerColor } from '../../types/GameTypes';
import { getPowerStrategy } from '../../core/powers';
import './hud.css';

const COLOR_MAP: Record<string, string> = {
  [PlayerColor.BLUE]: 'var(--color-blue)',
  [PlayerColor.RED]: 'var(--color-red)',
  [PlayerColor.GREEN]: 'var(--color-green)',
  [PlayerColor.YELLOW]: 'var(--color-yellow)',
};

interface PlayerPanelProps {
  player: PlayerState;
  isActive: boolean;
}

export function PlayerPanel({ player, isActive }: PlayerPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const power = getPowerStrategy(player.piratePower);

  return (
    <div
      className={`hud-panel player-card ${isActive ? 'hud-panel--active' : ''}`}
      style={{ borderLeft: `3px solid ${COLOR_MAP[player.color]}`, cursor: 'pointer' }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="player-card__name" style={{ color: COLOR_MAP[player.color] }}>
        {player.name}
        {player.isAI && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', opacity: 0.5, marginLeft: 4 }}>AI</span>}
      </div>
      <div className="player-card__power">
        {power.name}
        <span style={{ marginLeft: 4, fontSize: '0.55rem', opacity: 0.5 }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          marginBottom: 6,
          padding: '6px 8px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: `2px solid ${COLOR_MAP[player.color]}`,
        }}>
          {power.description}
          <div style={{ marginTop: 4, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
            Bounty: {power.bounty}
          </div>
        </div>
      )}

      <div className="player-card__stat">
        <span className="player-card__stat-label">Notoriety</span>
        <span className="player-card__stat-value" style={{ color: 'var(--color-red)' }}>
          {player.notoriety}
        </span>
      </div>

      <div className="player-card__stat">
        <span className="player-card__stat-label">Doubloons</span>
        <span className="player-card__stat-value" style={{ color: 'var(--text-gold)' }}>
          {player.doubloons}
        </span>
      </div>

      <div className="player-card__stat">
        <span className="player-card__stat-label">Fleet</span>
        <span className="player-card__stat-value">
          {player.ships.sloops}
          <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>S</span>
          {player.ships.galleons}
          <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>G</span>
        </span>
      </div>

      {player.placedCaptains.length > 0 && (
        <div className="player-card__actions">
          {player.placedCaptains.map((a, i) => (
            <span key={`${a}-${i}`} className="player-card__action-tag">{a}</span>
          ))}
        </div>
      )}
    </div>
  );
}
