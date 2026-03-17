import React, { useState } from 'react';
import { PlayerColor, ShipType } from '../../types/GameTypes';
import { HexCoord } from '../../types/CoordinateTypes';
import { Ship } from '../../game/types/GameState';

const COLOR_MAP: Record<string, string> = {
  [PlayerColor.BLUE]: '#3388dd',
  [PlayerColor.RED]: '#dd3333',
  [PlayerColor.GREEN]: '#33bb33',
  [PlayerColor.YELLOW]: '#ddcc33',
};

interface SinkTarget {
  playerId: string;
  playerName: string;
  playerColor: PlayerColor;
  shipType: ShipType;
}

interface SinkDialogProps {
  hex: HexCoord;
  targets: SinkTarget[];
  isRelentless: boolean;
  doubloons: number;
  onConfirm: (targetPlayerId: string, targetShipType: ShipType) => void;
  onCancel: () => void;
}

export function SinkDialog({ hex, targets, isRelentless, doubloons, onConfirm, onCancel }: SinkDialogProps) {
  const [selectedIdx, setSelectedIdx] = useState(targets.length === 1 ? 0 : -1);

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
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Sink Action</h3>
        <p style={{ margin: '0 0 16px', color: '#88aacc', fontSize: '0.85rem' }}>
          Sink an enemy ship at hex ({hex.q},{hex.r})
        </p>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.8rem', color: '#8899aa', marginBottom: 6 }}>Target ship:</div>
          {targets.map((t, i) => (
            <div
              key={`${t.playerId}-${t.shipType}-${i}`}
              onClick={() => setSelectedIdx(i)}
              style={{
                padding: '8px 12px',
                marginBottom: 4,
                background: selectedIdx === i ? 'rgba(80,30,30,0.8)' : 'rgba(20,30,40,0.8)',
                border: selectedIdx === i ? '2px solid #cc4444' : '1px solid #334455',
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
              <span style={{ fontSize: '0.85rem' }}>
                {t.playerName}'s {t.shipType}
              </span>
              {t.shipType === ShipType.GALLEON && (
                <span style={{ fontSize: '0.7rem', color: '#cc8844' }}>(needs influence)</span>
              )}
            </div>
          ))}
        </div>

        {isRelentless && (
          <div style={{ fontSize: '0.75rem', color: '#88cc88', marginBottom: 8 }}>
            The Relentless: first sloop pre-move is free
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: '#3a2a2a', color: '#cc8888',
            border: '1px solid #664444', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
          }}>
            Cancel
          </button>
          <button
            onClick={() => selectedIdx >= 0 && onConfirm(targets[selectedIdx].playerId, targets[selectedIdx].shipType)}
            disabled={selectedIdx < 0}
            style={{
              padding: '8px 20px',
              background: selectedIdx >= 0 ? '#6a2a2a' : '#222',
              color: selectedIdx >= 0 ? '#ffcccc' : '#666',
              border: selectedIdx >= 0 ? '1px solid #aa4444' : '1px solid #333',
              borderRadius: 6, cursor: selectedIdx >= 0 ? 'pointer' : 'default',
              fontSize: '0.85rem', fontWeight: 'bold',
            }}
          >
            Sink
          </button>
        </div>
      </div>
    </div>
  );
}
