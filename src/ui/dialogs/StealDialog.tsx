import React, { useState } from 'react';
import { PlayerState } from '../../game/types/GameState';
import { PlayerColor } from '../../types/GameTypes';
import { HexCoord } from '../../types/CoordinateTypes';

const COLOR_MAP: Record<string, string> = {
  [PlayerColor.BLUE]: '#2a6090',
  [PlayerColor.RED]: '#8b2500',
  [PlayerColor.GREEN]: '#2a6a3a',
  [PlayerColor.YELLOW]: '#9a7a1a',
};

interface StealTarget {
  playerId: string;
  playerName: string;
  playerColor: PlayerColor;
  sloopCount: number;
}

interface StealDialogProps {
  hex: HexCoord;
  targets: StealTarget[];
  canReplace: boolean; // player has sloops in inventory
  onConfirm: (targetPlayerId: string, replaceWithSloop: boolean) => void;
  onCancel: () => void;
}

export function StealDialog({ hex, targets, canReplace, onConfirm, onCancel }: StealDialogProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(
    targets.length === 1 ? targets[0].playerId : null
  );
  const [replace, setReplace] = useState(canReplace);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(59,42,26,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#e8dcc4',
        borderRadius: 8,
        padding: '24px 28px',
        maxWidth: 400,
        width: '90%',
        border: '2px solid #8b7355',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 16px rgba(60,40,20,0.4)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", color: '#3b2a1a' }}>Steal Action</h3>
        <p style={{ margin: '0 0 16px', color: '#6b5340', fontSize: '0.85rem', fontFamily: "'IM Fell English', Georgia, serif" }}>
          Steal an enemy sloop at this hex
        </p>

        {/* Target selection */}
        {targets.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', color: '#6b5340', marginBottom: 6 }}>Target:</div>
            {targets.map(t => (
              <div
                key={t.playerId}
                onClick={() => setSelectedTarget(t.playerId)}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  background: selectedTarget === t.playerId ? 'rgba(74,124,92,0.25)' : 'rgba(194,178,144,0.6)',
                  border: selectedTarget === t.playerId ? '2px solid #4a7c5c' : '1px solid #a89060',
                  borderRadius: 5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: COLOR_MAP[t.playerColor] ?? '#8b7355',
                }} />
                <span style={{ fontSize: '0.85rem', color: '#3b2a1a' }}>{t.playerName}</span>
                <span style={{ fontSize: '0.75rem', color: '#6b5340' }}>({t.sloopCount} sloop{t.sloopCount > 1 ? 's' : ''})</span>
              </div>
            ))}
          </div>
        )}

        {targets.length === 1 && (
          <div style={{
            padding: '8px 12px', marginBottom: 12,
            background: 'rgba(194,178,144,0.6)', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid #a89060',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: COLOR_MAP[targets[0].playerColor] ?? '#8b7355',
            }} />
            <span style={{ fontSize: '0.85rem', color: '#3b2a1a' }}>Stealing from {targets[0].playerName}</span>
          </div>
        )}

        {/* Replace option */}
        <div
          onClick={() => canReplace && setReplace(!replace)}
          style={{
            padding: '8px 12px',
            background: 'rgba(194,178,144,0.6)',
            border: '1px solid #a89060',
            borderRadius: 5,
            cursor: canReplace ? 'pointer' : 'default',
            opacity: canReplace ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: 3,
            border: '2px solid #5c3a1e',
            background: replace ? '#4a7c5c' : 'transparent',
          }} />
          <span style={{ fontSize: '0.85rem', color: '#3b2a1a' }}>Replace with your sloop</span>
          {!canReplace && <span style={{ fontSize: '0.75rem', color: '#8b2500' }}>(no sloops available)</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: '#8b2500', color: '#f4e8c1',
            border: '1px solid #6a1a00', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem',
            textShadow: '0 1px 1px rgba(0,0,0,0.3)',
          }}>
            Cancel
          </button>
          <button
            onClick={() => selectedTarget && onConfirm(selectedTarget, replace)}
            disabled={!selectedTarget}
            style={{
              padding: '8px 20px',
              background: selectedTarget ? '#4a7c5c' : '#b0a080',
              color: selectedTarget ? '#f4e8c1' : '#8b7960',
              border: selectedTarget ? '1px solid #3a6a4a' : '1px solid #a89060',
              borderRadius: 5, cursor: selectedTarget ? 'pointer' : 'default',
              fontSize: '0.85rem', fontWeight: 'bold',
              textShadow: selectedTarget ? '0 1px 1px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            Steal
          </button>
        </div>
      </div>
    </div>
  );
}
