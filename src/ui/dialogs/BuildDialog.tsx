import React, { useState } from 'react';
import { ShipType } from '../../types/GameTypes';
import { HexCoord } from '../../types/CoordinateTypes';

interface BuildDialogProps {
  hex: HexCoord;
  availableSloops: number;
  availableGalleons: number;
  doubloons: number;
  onConfirm: (placements: ShipType[], bribesUsed: number) => void;
  onCancel: () => void;
}

type BuildChoice = '2sloops' | '1galleon' | '1sloop';

export function BuildDialog({ hex, availableSloops, availableGalleons, doubloons, onConfirm, onCancel }: BuildDialogProps) {
  const [choice, setChoice] = useState<BuildChoice | null>(null);
  const [extraSloops, setExtraSloops] = useState(0);

  const can2Sloops = availableSloops >= 2;
  const can1Galleon = availableGalleons >= 1;
  const can1Sloop = availableSloops >= 1;

  // Extra sloops cost 1 doubloon each (bribe)
  const maxExtraSloops = Math.min(
    doubloons,
    choice === '1galleon' ? availableSloops : Math.max(0, availableSloops - (choice === '2sloops' ? 2 : 1))
  );

  const buildPlacements = (): ShipType[] => {
    const p: ShipType[] = [];
    if (choice === '2sloops') { p.push(ShipType.SLOOP, ShipType.SLOOP); }
    else if (choice === '1galleon') { p.push(ShipType.GALLEON); }
    else if (choice === '1sloop') { p.push(ShipType.SLOOP); }
    for (let i = 0; i < extraSloops; i++) p.push(ShipType.SLOOP);
    return p;
  };

  const bribesNeeded = choice === '1sloop' ? 0 : extraSloops;
  // 1 sloop is strictly worse than 2 sloops, only show if can't afford 2
  const showSingleSloop = !can2Sloops && can1Sloop;

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
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", color: '#3b2a1a' }}>Build Action</h3>
        <p style={{ margin: '0 0 16px', color: '#6b5340', fontSize: '0.85rem', fontFamily: "'IM Fell English', Georgia, serif" }}>
          Deploy ships at this hex
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {can2Sloops && (
            <div
              onClick={() => { setChoice('2sloops'); setExtraSloops(0); }}
              style={{
                padding: '10px 14px',
                background: choice === '2sloops' ? 'rgba(74,124,92,0.25)' : 'rgba(194,178,144,0.6)',
                border: choice === '2sloops' ? '2px solid #4a7c5c' : '1px solid #a89060',
                borderRadius: 6, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#3b2a1a' }}>2 Sloops</div>
              <div style={{ fontSize: '0.75rem', color: '#6b5340' }}>
                Deploy 2 sloops (free) — {availableSloops} available
              </div>
            </div>
          )}

          {can1Galleon && (
            <div
              onClick={() => { setChoice('1galleon'); setExtraSloops(0); }}
              style={{
                padding: '10px 14px',
                background: choice === '1galleon' ? 'rgba(74,124,92,0.25)' : 'rgba(194,178,144,0.6)',
                border: choice === '1galleon' ? '2px solid #4a7c5c' : '1px solid #a89060',
                borderRadius: 6, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#3b2a1a' }}>1 Galleon</div>
              <div style={{ fontSize: '0.75rem', color: '#6b5340' }}>
                Deploy 1 galleon (free) — {availableGalleons} available
              </div>
            </div>
          )}

          {showSingleSloop && (
            <div
              onClick={() => { setChoice('1sloop'); setExtraSloops(0); }}
              style={{
                padding: '10px 14px',
                background: choice === '1sloop' ? 'rgba(74,124,92,0.25)' : 'rgba(194,178,144,0.6)',
                border: choice === '1sloop' ? '2px solid #4a7c5c' : '1px solid #a89060',
                borderRadius: 6, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#3b2a1a' }}>1 Sloop</div>
              <div style={{ fontSize: '0.75rem', color: '#6b5340' }}>
                Deploy 1 sloop (free) — {availableSloops} available
              </div>
            </div>
          )}
        </div>

        {/* Extra sloops via bribes */}
        {choice && maxExtraSloops > 0 && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(194,178,144,0.6)',
            border: '1px solid #a89060',
            borderRadius: 6,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: '0.8rem', color: '#6b5340', marginBottom: 6 }}>
              Extra sloops (1 doubloon each):
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setExtraSloops(Math.max(0, extraSloops - 1))}
                disabled={extraSloops <= 0}
                style={{
                  width: 44, height: 44, borderRadius: 3,
                  background: 'rgba(184,150,62,0.2)', color: '#5c3a1e', border: '1px solid #a89060',
                  cursor: extraSloops > 0 ? 'pointer' : 'default', fontSize: '1rem',
                }}
              >−</button>
              <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center', color: '#3b2a1a' }}>{extraSloops}</span>
              <button
                onClick={() => setExtraSloops(Math.min(maxExtraSloops, extraSloops + 1))}
                disabled={extraSloops >= maxExtraSloops}
                style={{
                  width: 44, height: 44, borderRadius: 3,
                  background: 'rgba(184,150,62,0.2)', color: '#5c3a1e', border: '1px solid #a89060',
                  cursor: extraSloops < maxExtraSloops ? 'pointer' : 'default', fontSize: '1rem',
                }}
              >+</button>
              {extraSloops > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#8b6914' }}>
                  Cost: {extraSloops} doubloon{extraSloops > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {!can2Sloops && !can1Galleon && !can1Sloop && (
          <div style={{ color: '#8b2500', fontSize: '0.85rem', marginBottom: 12 }}>
            No ships available to build!
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: '#8b2500', color: '#f4e8c1',
            border: '1px solid #6a1a00', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem',
            textShadow: '0 1px 1px rgba(0,0,0,0.3)',
          }}>
            Cancel
          </button>
          <button
            onClick={() => choice && onConfirm(buildPlacements(), extraSloops)}
            disabled={!choice}
            style={{
              padding: '8px 20px',
              background: choice ? '#4a7c5c' : '#b0a080',
              color: choice ? '#f4e8c1' : '#8b7960',
              border: choice ? '1px solid #3a6a4a' : '1px solid #a89060',
              borderRadius: 5, cursor: choice ? 'pointer' : 'default',
              fontSize: '0.85rem', fontWeight: 'bold',
              textShadow: choice ? '0 1px 1px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            Build
          </button>
        </div>
      </div>
    </div>
  );
}
