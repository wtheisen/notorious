import React, { useState } from 'react';
import { AnyChart } from '../../core/Chart';
import { chartLabel, chartColor, chartDescription } from '../utils/chartFormatting';
import './hud.css';

interface ChartHandProps {
  charts: AnyChart[];
}

export function ChartHand({ charts }: ChartHandProps) {
  const [expanded, setExpanded] = useState(false);

  if (charts.length === 0) return null;

  return (
    <div style={{ position: 'absolute', bottom: 14, right: 14 }}>
      <button
        className="hud-btn hud-btn--ghost chart-hand__toggle"
        onClick={() => setExpanded(!expanded)}
        style={{ background: 'var(--hud-bg)', border: '1px solid var(--hud-border)' }}
      >
        <span style={{ color: 'var(--text-gold)', marginRight: 4 }}>🗺️</span>
        Charts ({charts.length})
        <span style={{ marginLeft: 6, fontSize: '0.6rem' }}>{expanded ? '▾' : '▴'}</span>
      </button>
      {expanded && (
        <div
          className="hud-panel chart-hand__list"
          style={{ position: 'absolute', bottom: 38, right: 0 }}
        >
          {charts.map(chart => (
            <div
              key={chart.id}
              className="chart-card"
              style={{ borderLeft: `3px solid ${chartColor(chart)}`, marginBottom: 4 }}
            >
              <div style={{ fontWeight: 'bold' }}>{chartLabel(chart)}</div>
              <div style={{ fontSize: '0.75em', opacity: 0.8, marginTop: 2 }}>{chartDescription(chart)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
