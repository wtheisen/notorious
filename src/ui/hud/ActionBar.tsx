import React from 'react';
import { ActionType } from '../../types/GameTypes';
import './hud.css';

const ACTION_LABELS: Record<ActionType, { label: string; desc: string; icon: string }> = {
  [ActionType.SAIL]: { label: 'Sail', desc: 'Move ships', icon: '⛵' },
  [ActionType.BUILD]: { label: 'Build', desc: 'Deploy ships', icon: '🔨' },
  [ActionType.STEAL]: { label: 'Steal', desc: 'Take a ship', icon: '🏴' },
  [ActionType.SINK]: { label: 'Sink', desc: 'Destroy a ship', icon: '💀' },
  [ActionType.CHART]: { label: 'Chart', desc: 'Draw charts', icon: '🗺️' },
};

interface ActionBarProps {
  phase: 'place' | 'play';
  placedCaptains: ActionType[];
  captainCount: number;
  currentAction?: ActionType | null;
  disabledActions?: ActionType[];
  onPlaceCaptain?: (action: ActionType) => void;
  onExecuteAction?: (action: ActionType) => void;
  onForfeit?: () => void;
}

export function ActionBar({
  phase,
  placedCaptains,
  captainCount,
  currentAction,
  disabledActions = [],
  onPlaceCaptain,
  onExecuteAction,
  onForfeit,
}: ActionBarProps) {
  const allActions = Object.values(ActionType).filter(a => !disabledActions.includes(a));
  const captainsRemaining = captainCount - placedCaptains.length;

  return (
    <div
      className="hud-panel"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        padding: '10px 14px',
        alignItems: 'center',
      }}
    >
      {phase === 'place' && (
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.05em',
          marginRight: 6,
          textTransform: 'uppercase',
          lineHeight: 1.3,
          maxWidth: 70,
        }}>
          Assign<br />Captain
          <span style={{ display: 'block', color: 'var(--text-gold)', fontSize: '0.7rem', marginTop: 2 }}>
            {captainsRemaining} left
          </span>
        </div>
      )}
      {phase === 'play' && placedCaptains.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No actions remaining
        </div>
      )}

      {allActions.map(action => {
        const info = ACTION_LABELS[action];
        const isPlaced = placedCaptains.includes(action);
        const isCurrentAction = currentAction === action;

        if (phase === 'place') {
          const cls = [
            'action-btn',
            isPlaced ? 'action-btn--placed' : '',
            isCurrentAction ? 'action-btn--active' : '',
            captainsRemaining <= 0 ? 'action-btn--disabled' : '',
          ].filter(Boolean).join(' ');

          return (
            <button key={action} className={cls} onClick={() => onPlaceCaptain?.(action)}>
              <span className="action-btn__icon">{info.icon}</span>
              <span className="action-btn__label">{info.label}</span>
              {isPlaced && <span className="action-btn__desc" style={{ color: 'var(--color-green)' }}>placed</span>}
            </button>
          );
        }

        if (!isPlaced) return null;

        const cls = [
          'action-btn',
          isCurrentAction ? 'action-btn--active' : '',
        ].filter(Boolean).join(' ');

        return (
          <button key={action} className={cls} onClick={() => onExecuteAction?.(action)}>
            <span className="action-btn__icon">{info.icon}</span>
            <span className="action-btn__label">{info.label}</span>
            <span className="action-btn__desc">{info.desc}</span>
          </button>
        );
      })}

      {phase === 'play' && onForfeit && placedCaptains.length > 0 && (
        <button
          className="hud-btn hud-btn--danger"
          onClick={onForfeit}
          style={{ padding: '8px 12px', fontSize: '0.73rem', marginLeft: 4 }}
        >
          Pass
        </button>
      )}
    </div>
  );
}
