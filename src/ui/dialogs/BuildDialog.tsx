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
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Build Action</h3>
        <p style={{ margin: '0 0 16px', color: '#88aacc', fontSize: '0.85rem' }}>
          Deploy ships at hex ({hex.q},{hex.r})
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {can2Sloops && (
            <div
              onClick={() => { setChoice('2sloops'); setExtraSloops(0); }}
              style={{
                padding: '10px 14px',
                background: choice === '2sloops' ? 'rgba(40,80,60,0.8)' : 'rgba(20,30,40,0.8)',
                border: choice === '2sloops' ? '2px solid #44aa66' : '1px solid #334455',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>2 Sloops</div>
              <div style={{ fontSize: '0.75rem', color: '#8899aa' }}>
                Deploy 2 sloops (free) — {availableSloops} available
              </div>
            </div>
          )}

          {can1Galleon && (
            <div
              onClick={() => { setChoice('1galleon'); setExtraSloops(0); }}
              style={{
                padding: '10px 14px',
                background: choice === '1galleon' ? 'rgba(40,80,60,0.8)' : 'rgba(20,30,40,0.8)',
                border: choice === '1galleon' ? '2px solid #44aa66' : '1px solid #334455',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>1 Galleon</div>
              <div style={{ fontSize: '0.75rem', color: '#8899aa' }}>
                Deploy 1 galleon (free) — {availableGalleons} available
              </div>
            </div>
          )}

          {showSingleSloop && (
            <div
              onClick={() => { setChoice('1sloop'); setExtraSloops(0); }}
              style={{
                padding: '10px 14px',
                background: choice === '1sloop' ? 'rgba(40,80,60,0.8)' : 'rgba(20,30,40,0.8)',
                border: choice === '1sloop' ? '2px solid #44aa66' : '1px solid #334455',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>1 Sloop</div>
              <div style={{ fontSize: '0.75rem', color: '#8899aa' }}>
                Deploy 1 sloop (free) — {availableSloops} available
              </div>
            </div>
          )}
        </div>

        {/* Extra sloops via bribes */}
        {choice && maxExtraSloops > 0 && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(20,30,40,0.8)',
            border: '1px solid #334455',
            borderRadius: 8,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: '0.8rem', color: '#8899aa', marginBottom: 6 }}>
              Extra sloops (1 doubloon each):
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setExtraSloops(Math.max(0, extraSloops - 1))}
                disabled={extraSloops <= 0}
                style={{
                  width: 28, height: 28, borderRadius: 4,
                  background: '#2a3a4a', color: '#ccddee', border: '1px solid #445566',
                  cursor: extraSloops > 0 ? 'pointer' : 'default', fontSize: '1rem',
                }}
              >−</button>
              <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{extraSloops}</span>
              <button
                onClick={() => setExtraSloops(Math.min(maxExtraSloops, extraSloops + 1))}
                disabled={extraSloops >= maxExtraSloops}
                style={{
                  width: 28, height: 28, borderRadius: 4,
                  background: '#2a3a4a', color: '#ccddee', border: '1px solid #445566',
                  cursor: extraSloops < maxExtraSloops ? 'pointer' : 'default', fontSize: '1rem',
                }}
              >+</button>
              {extraSloops > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#ccaa44' }}>
                  Cost: {extraSloops} doubloon{extraSloops > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {!can2Sloops && !can1Galleon && !can1Sloop && (
          <div style={{ color: '#aa6666', fontSize: '0.85rem', marginBottom: 12 }}>
            No ships available to build!
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
            onClick={() => choice && onConfirm(buildPlacements(), extraSloops)}
            disabled={!choice}
            style={{
              padding: '8px 20px',
              background: choice ? '#2a6a3a' : '#222',
              color: choice ? '#ccffcc' : '#666',
              border: choice ? '1px solid #44aa44' : '1px solid #333',
              borderRadius: 6, cursor: choice ? 'pointer' : 'default',
              fontSize: '0.85rem', fontWeight: 'bold',
            }}
          >
            Build
          </button>
        </div>
      </div>
    </div>
  );
}
