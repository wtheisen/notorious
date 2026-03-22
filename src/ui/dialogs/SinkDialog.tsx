import React, { useState } from 'react';
import { PlayerColor, ShipType } from '../../types/GameTypes';
import { HexCoord } from '../../types/CoordinateTypes';

const COLOR_MAP: Record<string, string> = {
  [PlayerColor.BLUE]: '#2a6090',
  [PlayerColor.RED]: '#8b2500',
  [PlayerColor.GREEN]: '#2a6a3a',
  [PlayerColor.YELLOW]: '#9a7a1a',
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
  onConfirm: (primaryIdx: number, additionalIndices: number[]) => void;
  onCancel: () => void;
}

export function SinkDialog({ hex, targets, isRelentless, doubloons, onConfirm, onCancel }: SinkDialogProps) {
  // First selected = primary (free), rest = additional (1 dbl each)
  const [selectedIndices, setSelectedIndices] = useState<number[]>(targets.length === 1 ? [0] : []);

  const primaryIdx = selectedIndices[0] ?? -1;
  const additionalCount = Math.max(0, selectedIndices.length - 1);
  const bribeCost = additionalCount;

  const toggleTarget = (idx: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(idx)) {
        // Removing: if it's the primary (first), remove all; otherwise just remove this one
        if (prev[0] === idx) return [];
        return prev.filter(i => i !== idx);
      } else {
        // Adding: check doubloon budget for additional sinks
        if (prev.length === 0) return [idx]; // free primary
        const newAdditional = prev.length; // current length = how many additional this would be
        if (newAdditional > doubloons) return prev; // can't afford
        return [...prev, idx];
      }
    });
  };

  const canConfirm = selectedIndices.length >= 1;

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
        border: '2px solid #8b2500',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 16px rgba(60,40,20,0.4)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", color: '#8b2500' }}>Sink Action</h3>
        <p style={{ margin: '0 0 4px', color: '#6b5340', fontSize: '0.85rem', fontFamily: "'IM Fell English', Georgia, serif" }}>
          Sink enemy ships at this hex
        </p>
        {targets.length > 1 && doubloons > 0 && (
          <p style={{ margin: '0 0 12px', color: '#8b7960', fontSize: '0.75rem' }}>
            First target is free. Each additional costs 1 doubloon ({doubloons} available).
          </p>
        )}
        {(targets.length <= 1 || doubloons <= 0) && (
          <div style={{ marginBottom: 12 }} />
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.8rem', color: '#6b5340', marginBottom: 6 }}>
            Target ship{targets.length > 1 && doubloons > 0 ? 's' : ''}:
          </div>
          {targets.map((t, i) => {
            const orderInSelection = selectedIndices.indexOf(i);
            const isSelected = orderInSelection >= 0;
            const isPrimary = orderInSelection === 0;
            const isAdditional = orderInSelection > 0;
            // Can select if: not selected AND (no selection yet OR has doubloons for additional)
            const canSelect = !isSelected && (selectedIndices.length === 0 || selectedIndices.length <= doubloons);

            return (
              <div
                key={`${t.playerId}-${t.shipType}-${i}`}
                onClick={() => (isSelected || canSelect) && toggleTarget(i)}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  background: isSelected ? 'rgba(139,37,0,0.15)' : 'rgba(194,178,144,0.6)',
                  border: isSelected ? '2px solid #8b2500' : '1px solid #a89060',
                  borderRadius: 5,
                  cursor: (isSelected || canSelect) ? 'pointer' : 'default',
                  opacity: (!isSelected && !canSelect) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: COLOR_MAP[t.playerColor] ?? '#8b7355',
                }} />
                <span style={{ fontSize: '0.85rem', flex: 1, color: '#3b2a1a' }}>
                  {t.playerName}'s {t.shipType}
                </span>
                {t.shipType === ShipType.GALLEON && (
                  <span style={{ fontSize: '0.7rem', color: '#8b6914' }}>(needs influence)</span>
                )}
                {isPrimary && (
                  <span style={{ fontSize: '0.7rem', color: '#8b2500', fontWeight: 600 }}>PRIMARY</span>
                )}
                {isAdditional && (
                  <span style={{ fontSize: '0.7rem', color: '#8b6914' }}>+1 dbl</span>
                )}
              </div>
            );
          })}
        </div>

        {bribeCost > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#8b6914', marginBottom: 8 }}>
            Cost: {bribeCost} doubloon{bribeCost > 1 ? 's' : ''} for {additionalCount} extra sink{additionalCount > 1 ? 's' : ''}
          </div>
        )}

        {isRelentless && (
          <div style={{ fontSize: '0.75rem', color: '#4a7c5c', marginBottom: 8 }}>
            The Relentless: first sloop pre-move is free
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: '#8b7355', color: '#f4e8c1',
            border: '1px solid #6b5340', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem',
            textShadow: '0 1px 1px rgba(0,0,0,0.3)',
          }}>
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(selectedIndices[0], selectedIndices.slice(1))}
            disabled={!canConfirm}
            style={{
              padding: '8px 20px',
              background: canConfirm ? '#8b2500' : '#b0a080',
              color: canConfirm ? '#f4e8c1' : '#8b7960',
              border: canConfirm ? '1px solid #6a1a00' : '1px solid #a89060',
              borderRadius: 5, cursor: canConfirm ? 'pointer' : 'default',
              fontSize: '0.85rem', fontWeight: 'bold',
              textShadow: canConfirm ? '0 1px 1px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            Sink {selectedIndices.length} ship{selectedIndices.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
