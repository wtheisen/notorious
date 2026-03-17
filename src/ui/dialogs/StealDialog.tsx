import React, { useState } from 'react';
import { PlayerState } from '../../game/types/GameState';
import { PlayerColor } from '../../types/GameTypes';
import { HexCoord } from '../../types/CoordinateTypes';

const COLOR_MAP: Record<string, string> = {
  [PlayerColor.BLUE]: '#3388dd',
  [PlayerColor.RED]: '#dd3333',
  [PlayerColor.GREEN]: '#33bb33',
  [PlayerColor.YELLOW]: '#ddcc33',
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
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: '#1a2a3a',
        borderRadius: 12,
        padding: '24px 28px',
        maxWidth: 400,
        width: '90%',
        border: '1px solid #334455',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Steal Action</h3>
        <p style={{ margin: '0 0 16px', color: '#88aacc', fontSize: '0.85rem' }}>
          Steal an enemy sloop at hex ({hex.q},{hex.r})
        </p>

        {/* Target selection */}
        {targets.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', color: '#8899aa', marginBottom: 6 }}>Target:</div>
            {targets.map(t => (
              <div
                key={t.playerId}
                onClick={() => setSelectedTarget(t.playerId)}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  background: selectedTarget === t.playerId ? 'rgba(40,80,60,0.8)' : 'rgba(20,30,40,0.8)',
                  border: selectedTarget === t.playerId ? '2px solid #44aa66' : '1px solid #334455',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: COLOR_MAP[t.playerColor] ?? '#888',
                }} />
                <span style={{ fontSize: '0.85rem' }}>{t.playerName}</span>
                <span style={{ fontSize: '0.75rem', color: '#8899aa' }}>({t.sloopCount} sloop{t.sloopCount > 1 ? 's' : ''})</span>
              </div>
            ))}
          </div>
        )}

        {targets.length === 1 && (
          <div style={{
            padding: '8px 12px', marginBottom: 12,
            background: 'rgba(20,30,40,0.8)', borderRadius: 6,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: COLOR_MAP[targets[0].playerColor] ?? '#888',
            }} />
            <span style={{ fontSize: '0.85rem' }}>Stealing from {targets[0].playerName}</span>
          </div>
        )}

        {/* Replace option */}
        <div
          onClick={() => canReplace && setReplace(!replace)}
          style={{
            padding: '8px 12px',
            background: 'rgba(20,30,40,0.8)',
            border: '1px solid #334455',
            borderRadius: 6,
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
            border: '2px solid #558866',
            background: replace ? '#44aa66' : 'transparent',
          }} />
          <span style={{ fontSize: '0.85rem' }}>Replace with your sloop</span>
          {!canReplace && <span style={{ fontSize: '0.75rem', color: '#aa6666' }}>(no sloops available)</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: '#3a2a2a', color: '#cc8888',
            border: '1px solid #664444', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
          }}>
            Cancel
          </button>
          <button
            onClick={() => selectedTarget && onConfirm(selectedTarget, replace)}
            disabled={!selectedTarget}
            style={{
              padding: '8px 20px',
              background: selectedTarget ? '#2a6a3a' : '#222',
              color: selectedTarget ? '#ccffcc' : '#666',
              border: selectedTarget ? '1px solid #44aa44' : '1px solid #333',
              borderRadius: 6, cursor: selectedTarget ? 'pointer' : 'default',
              fontSize: '0.85rem', fontWeight: 'bold',
            }}
          >
            Steal
          </button>
        </div>
      </div>
    </div>
  );
}
