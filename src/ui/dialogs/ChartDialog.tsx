import React, { useState } from 'react';
import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../../core/Chart';
import { ChartType } from '../../types/GameTypes';

interface ChartDialogProps {
  drawnCharts: AnyChart[];
  keepCount: number;
  onConfirm: (selectedIds: string[]) => void;
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
    case ChartType.TREASURE_MAP: return '#c4a43a';
    case ChartType.ISLAND_RAID: return '#cc4444';
    case ChartType.SMUGGLER_ROUTE: return '#4488cc';
    default: return '#888';
  }
}

export function ChartDialog({ drawnCharts, keepCount, onConfirm, onCancel }: ChartDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const canConfirm = selected.size === keepCount;

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
        maxWidth: 500,
        width: '90%',
        border: '1px solid #334455',
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Chart Action</h3>
        <p style={{ margin: '0 0 16px', color: '#88aacc', fontSize: '0.85rem' }}>
          Drew {drawnCharts.length} charts — select {keepCount} to keep
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {drawnCharts.map(chart => {
            const isSelected = selected.has(chart.id);
            return (
              <div
                key={chart.id}
                onClick={() => toggleChart(chart.id)}
                style={{
                  padding: '12px 14px',
                  background: isSelected ? 'rgba(40,80,60,0.8)' : 'rgba(20,30,40,0.8)',
                  border: isSelected ? '2px solid #44aa66' : '1px solid #334455',
                  borderRadius: 8,
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
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {chartLabel(chart)}
                  </div>
                  {isSelected && (
                    <div style={{ marginLeft: 'auto', color: '#44aa66', fontSize: '0.8rem' }}>KEEP</div>
                  )}
                </div>
                <div style={{ color: '#8899aa', fontSize: '0.75rem', marginTop: 4, paddingLeft: 18 }}>
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
              padding: '8px 16px', background: '#3a2a2a', color: '#cc8888',
              border: '1px solid #664444', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(Array.from(selected))}
            disabled={!canConfirm}
            style={{
              padding: '8px 20px',
              background: canConfirm ? '#2a6a3a' : '#222',
              color: canConfirm ? '#ccffcc' : '#666',
              border: canConfirm ? '1px solid #44aa44' : '1px solid #333',
              borderRadius: 6,
              cursor: canConfirm ? 'pointer' : 'default',
              fontSize: '0.85rem',
              fontWeight: 'bold',
            }}
          >
            Keep {selected.size}/{keepCount}
          </button>
        </div>
      </div>
    </div>
  );
}
