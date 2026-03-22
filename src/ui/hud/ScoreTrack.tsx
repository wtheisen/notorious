import React from 'react';
import { PlayerState } from '../../game/types/GameState';
import { PlayerColor, GAME_CONSTANTS } from '../../types/GameTypes';
import './hud.css';

const WINNING = GAME_CONSTANTS.WINNING_NOTORIETY;
const CAPTAIN_THRESHOLDS = GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS;
const RAID_THRESHOLDS = GAME_CONSTANTS.ISLAND_RAID_THRESHOLDS;

const MILESTONES: { at: number; label: string; icon: string }[] = [
  { at: CAPTAIN_THRESHOLDS[0], label: '3rd Captain', icon: '⚓' },
  { at: CAPTAIN_THRESHOLDS[1], label: '4th Captain', icon: '⚓' },
  { at: RAID_THRESHOLDS[0], label: '1st Raid', icon: '☠' },
  { at: RAID_THRESHOLDS[1], label: '2nd Raid', icon: '☠' },
];

const CUBE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  [PlayerColor.BLUE]:   { bg: '#4499ee', border: '#2a6090', text: '#fff' },
  [PlayerColor.RED]:    { bg: '#ee4455', border: '#8b2500', text: '#fff' },
  [PlayerColor.GREEN]:  { bg: '#44cc55', border: '#2a6a3a', text: '#fff' },
  [PlayerColor.YELLOW]: { bg: '#eebb33', border: '#9a7a1a', text: '#3b2a1a' },
};

interface ScoreTrackProps {
  players: PlayerState[];
  currentPlayerId: string;
}

export function ScoreTrack({ players, currentPlayerId }: ScoreTrackProps) {
  // Group players by notoriety value for stacking
  const grouped = new Map<number, PlayerState[]>();
  for (const p of players) {
    const list = grouped.get(p.notoriety) || [];
    list.push(p);
    grouped.set(p.notoriety, list);
  }

  return (
    <div className="hud-panel score-track">
      <div className="score-track__header">
        <span className="score-track__title">Notoriety</span>
        <span className="score-track__goal">{WINNING}</span>
      </div>

      <div className="score-track__lane">
        {/* Track background line */}
        <div className="score-track__rail" />

        {/* Tick marks */}
        {Array.from({ length: WINNING + 1 }, (_, i) => {
          const isMajor = i % 7 === 0 || i === WINNING;
          return (
            <div
              key={i}
              className={`score-track__tick ${isMajor ? 'score-track__tick--major' : ''}`}
              style={{ left: `${(i / WINNING) * 100}%` }}
            >
              {isMajor && (
                <span className="score-track__tick-label">{i}</span>
              )}
            </div>
          );
        })}

        {/* Milestone markers */}
        {MILESTONES.map(m => (
          <div
            key={m.at + m.icon}
            className="score-track__milestone"
            style={{ left: `${(m.at / WINNING) * 100}%` }}
            title={`${m.at}: ${m.label}`}
          >
            <span className="score-track__milestone-icon">{m.icon}</span>
          </div>
        ))}

        {/* Player cubes */}
        {Array.from(grouped.entries()).map(([notoriety, group]) =>
          group.map((player, stackIdx) => {
            const pct = (notoriety / WINNING) * 100;
            const colors = CUBE_COLORS[player.color] || CUBE_COLORS[PlayerColor.BLUE];
            const isActive = player.id === currentPlayerId;
            const stackOffset = group.length > 1
              ? (stackIdx - (group.length - 1) / 2) * 18
              : 0;

            return (
              <div
                key={player.id}
                className={`score-track__cube ${isActive ? 'score-track__cube--active' : ''}`}
                style={{
                  left: `${pct}%`,
                  transform: `translateX(-50%) translateY(${stackOffset}px)`,
                  background: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                  zIndex: isActive ? 10 : 5,
                }}
                title={`${player.name}: ${notoriety} notoriety, ${player.doubloons} doubloons`}
              >
                {player.name.charAt(0)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
