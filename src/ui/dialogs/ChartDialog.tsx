import React, { useState } from 'react';
import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../../core/Chart';
import { ChartType } from '../../types/GameTypes';

interface ChartDialogProps {
  drawnCharts: AnyChart[];
  keepCount: number;
  maxDoubloons: number;
  onConfirm: (selectedIds: string[], bribeChoices: ('draw' | 'keep')[]) => void;
  onCancel: () => void;
}

function chartLabel(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP:
      return `Treasure Map (${(chart as TreasureMapChart).targetHex.q},${(chart as TreasureMapChart).targetHex.r})`;
    case ChartType.ISLAND_RAID:
      return `Island Raid: ${(chart as IslandRaidChart).targetIsland}`;
    case ChartType.SMUGGLER_ROUTE:
      return `Smuggler Route: ${(chart as SmugglerRouteChart).islandA} — ${(chart as SmugglerRouteChart).islandB}`;
    default:
      return 'Unknown Chart';
  }
}

function chartDescription(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP:
      return 'Control this hex to claim 1 doubloon per player';
    case ChartType.ISLAND_RAID: {
      const raid = chart as IslandRaidChart;
      return `Control ${raid.targetIsland} to claim 4 notoriety + ${raid.doubloonsOnChart} doubloons`;
    }
    case ChartType.SMUGGLER_ROUTE: {
      const route = chart as SmugglerRouteChart;
      return `Connect ${route.islandA} to ${route.islandB} with your ships for doubloons`;
    }
    default:
      return '';
  }
}

function chartColor(chart: AnyChart): string {
  switch (chart.type) {
    case ChartType.TREASURE_MAP: return '#b8963e';
    case ChartType.ISLAND_RAID: return '#8b2500';
    case ChartType.SMUGGLER_ROUTE: return '#4a6a5a';
    default: return '#8b7355';
  }
}

export function ChartDialog({ drawnCharts, keepCount: baseKeepCount, maxDoubloons, onConfirm, onCancel }: ChartDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraDraw, setExtraDraw] = useState(0);
  const [extraKeep, setExtraKeep] = useState(0);

  const totalBribes = extraDraw + extraKeep;
  const doubloonsLeft = maxDoubloons - totalBribes;

  const baseDrawCount = 2;
  const drawCount = baseDrawCount + extraDraw;
  const keepCount = baseKeepCount + extraKeep;

  // Only show charts up to the current draw count
  const visibleCharts = drawnCharts.slice(0, Math.min(drawCount, drawnCharts.length));

  const toggleChart = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < keepCount) {
        next.add(id);
      }
      return next;
    });
  };

  // When reducing draw count, deselect any charts that are no longer visible
  const adjustDraw = (delta: number) => {
    const newExtra = extraDraw + delta;
    if (newExtra < 0) return;
    if (delta > 0 && doubloonsLeft <= 0) return;
    if (delta > 0 && baseDrawCount + newExtra > drawnCharts.length) return;
    setExtraDraw(newExtra);
    // Deselect charts beyond new visible range
    if (delta < 0) {
      const newVisible = baseDrawCount + newExtra;
      const visibleIds = new Set(drawnCharts.slice(0, newVisible).map(c => c.id));
      setSelected(prev => {
        const next = new Set<string>();
        for (const id of prev) {
          if (visibleIds.has(id)) next.add(id);
        }
        return next;
      });
    }
  };

  const adjustKeep = (delta: number) => {
    const newExtra = extraKeep + delta;
    if (newExtra < 0) return;
    if (delta > 0 && doubloonsLeft <= 0) return;
    // Can't keep more than we draw
    if (baseKeepCount + newExtra > visibleCharts.length) return;
    setExtraKeep(newExtra);
    // If reducing keep, deselect excess
    if (delta < 0) {
      const newKeep = baseKeepCount + newExtra;
      setSelected(prev => {
        if (prev.size <= newKeep) return prev;
        const next = new Set<string>();
        let count = 0;
        for (const id of prev) {
          if (count >= newKeep) break;
          next.add(id);
          count++;
        }
        return next;
      });
    }
  };

  const canConfirm = selected.size === keepCount || (selected.size === visibleCharts.length && visibleCharts.length <= keepCount);

  const buildBribeChoices = (): ('draw' | 'keep')[] => {
    const choices: ('draw' | 'keep')[] = [];
    for (let i = 0; i < extraDraw; i++) choices.push('draw');
    for (let i = 0; i < extraKeep; i++) choices.push('keep');
    return choices;
  };

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
        maxWidth: 500,
        width: '90%',
        border: '2px solid #8b7355',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 16px rgba(60,40,20,0.4)',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontFamily: "'Cinzel', serif", color: '#3b2a1a' }}>Chart Action</h3>
        <p style={{ margin: '0 0 12px', color: '#6b5340', fontSize: '0.85rem', fontFamily: "'IM Fell English', Georgia, serif" }}>
          Draw {drawCount}, keep {keepCount}
          {totalBribes > 0 && <span style={{ color: '#8b6914' }}> — {totalBribes} doubloon{totalBribes > 1 ? 's' : ''}</span>}
        </p>

        {/* Bribe controls */}
        {maxDoubloons > 0 && (
          <div style={{
            display: 'flex', gap: 16, marginBottom: 14, padding: '8px 10px',
            background: 'rgba(184,150,62,0.15)', borderRadius: 5, border: '1px solid #a89060',
            fontSize: '0.8rem', alignItems: 'center',
          }}>
            <span style={{ color: '#8b6914', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Bribes ({doubloonsLeft} dbl left)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => adjustDraw(-1)} disabled={extraDraw <= 0}
                style={bribeBtnStyle(extraDraw > 0)}>−</button>
              <span style={{ minWidth: 70, textAlign: 'center', color: '#6b5340' }}>Draw +{extraDraw}</span>
              <button onClick={() => adjustDraw(1)} disabled={doubloonsLeft <= 0 || baseDrawCount + extraDraw >= drawnCharts.length}
                style={bribeBtnStyle(doubloonsLeft > 0 && baseDrawCount + extraDraw < drawnCharts.length)}>+</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => adjustKeep(-1)} disabled={extraKeep <= 0}
                style={bribeBtnStyle(extraKeep > 0)}>−</button>
              <span style={{ minWidth: 70, textAlign: 'center', color: '#6b5340' }}>Keep +{extraKeep}</span>
              <button onClick={() => adjustKeep(1)} disabled={doubloonsLeft <= 0 || keepCount >= visibleCharts.length}
                style={bribeBtnStyle(doubloonsLeft > 0 && keepCount < visibleCharts.length)}>+</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleCharts.map(chart => {
            const isSelected = selected.has(chart.id);
            return (
              <div
                key={chart.id}
                onClick={() => toggleChart(chart.id)}
                style={{
                  padding: '12px 14px',
                  background: isSelected ? 'rgba(74,124,92,0.25)' : 'rgba(194,178,144,0.6)',
                  border: isSelected ? '2px solid #4a7c5c' : '1px solid #a89060',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: chartColor(chart),
                    flexShrink: 0,
                  }} />
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#3b2a1a' }}>
                    {chartLabel(chart)}
                  </div>
                  {isSelected && (
                    <div style={{ marginLeft: 'auto', color: '#4a7c5c', fontSize: '0.8rem', fontWeight: 'bold' }}>KEEP</div>
                  )}
                </div>
                <div style={{ color: '#6b5340', fontSize: '0.75rem', marginTop: 4, paddingLeft: 18 }}>
                  {chartDescription(chart)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', background: '#8b2500', color: '#f4e8c1',
              border: '1px solid #6a1a00', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem',
              textShadow: '0 1px 1px rgba(0,0,0,0.3)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(Array.from(selected), buildBribeChoices())}
            disabled={!canConfirm}
            style={{
              padding: '8px 20px',
              background: canConfirm ? '#4a7c5c' : '#b0a080',
              color: canConfirm ? '#f4e8c1' : '#8b7960',
              border: canConfirm ? '1px solid #3a6a4a' : '1px solid #a89060',
              borderRadius: 5,
              cursor: canConfirm ? 'pointer' : 'default',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              textShadow: canConfirm ? '0 1px 1px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            Keep {selected.size}/{keepCount}
          </button>
        </div>
      </div>
    </div>
  );
}

function bribeBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    width: 44, height: 44, padding: 0,
    background: enabled ? 'rgba(184,150,62,0.3)' : 'rgba(139,115,85,0.15)',
    color: enabled ? '#8b6914' : '#a89060',
    border: enabled ? '1px solid #a89060' : '1px solid #c4b28a',
    borderRadius: 3, cursor: enabled ? 'pointer' : 'default',
    fontSize: '0.85rem', fontWeight: 'bold',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
