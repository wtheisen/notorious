import React, { useState } from 'react';
import { PlayerState } from '../../game/types/GameState';
import { PlayerColor } from '../../types/GameTypes';
import { PlayerPanel } from './PlayerPanel';
import './hud.css';

const DOT_COLORS: Record<string, string> = {
  [PlayerColor.BLUE]: 'var(--color-blue)',
  [PlayerColor.RED]: 'var(--color-red)',
  [PlayerColor.GREEN]: 'var(--color-green)',
  [PlayerColor.YELLOW]: 'var(--color-yellow)',
};

interface MobilePlayerDrawerProps {
  players: PlayerState[];
  currentPlayerId: string;
}

export function MobilePlayerDrawer({ players, currentPlayerId }: MobilePlayerDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div data-testid="mobile-player-drawer" style={{ position: 'absolute', top: 6, right: 6, zIndex: 20 }}>
      {/* Compact bar: colored dots with scores */}
      <div
        className="hud-panel"
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 10px',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {players.map(p => {
          const isActive = p.id === currentPlayerId;
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <div style={{
                width: isActive ? 12 : 8,
                height: isActive ? 12 : 8,
                borderRadius: '50%',
                background: DOT_COLORS[p.color] ?? '#888',
                border: isActive ? '2px solid var(--hud-border-bright)' : '1px solid var(--hud-border)',
                transition: 'all 0.2s',
              }} />
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.6rem',
                fontWeight: isActive ? 700 : 400,
                color: 'var(--text-primary)',
              }}>
                {p.notoriety}
              </span>
            </div>
          );
        })}
        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginLeft: 2 }}>
          {expanded ? '▾' : '▸'}
        </span>
      </div>

      {/* Expanded: full player panels */}
      {expanded && (
        <div style={{
          marginTop: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: '70vh',
          overflowY: 'auto',
        }}>
          {players.map(p => (
            <PlayerPanel key={p.id} player={p} isActive={p.id === currentPlayerId} />
          ))}
        </div>
      )}
    </div>
  );
}
