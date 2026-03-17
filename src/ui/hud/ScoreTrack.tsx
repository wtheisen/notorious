import React from 'react';
import { PlayerState } from '../../game/types/GameState';
import { PlayerColor, GAME_CONSTANTS } from '../../types/GameTypes';
import './hud.css';

const WINNING = GAME_CONSTANTS.WINNING_NOTORIETY;
const CAPTAIN_THRESHOLDS = GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS;
const RAID_THRESHOLDS = GAME_CONSTANTS.ISLAND_RAID_THRESHOLDS;

/** Milestone markers on the track */
const MILESTONES: { at: number; label: string; icon: string }[] = [
  { at: CAPTAIN_THRESHOLDS[0], label: '3rd Captain', icon: '⚓' },
  { at: CAPTAIN_THRESHOLDS[1], label: '4th Captain', icon: '⚓⚓' },
  { at: RAID_THRESHOLDS[0], label: '1st Raid claimable · 2nd Raid revealed', icon: '☠' },
  { at: RAID_THRESHOLDS[1], label: '2nd Raid claimable', icon: '☠☠' },
];

const COLOR_HEX: Record<string, string> = {
  [PlayerColor.BLUE]: '#4499ee',
  [PlayerColor.RED]: '#ee4455',
  [PlayerColor.GREEN]: '#44cc55',
  [PlayerColor.YELLOW]: '#eebb33',
};

const COLOR_DARK: Record<string, string> = {
  [PlayerColor.BLUE]: '#2a6090',
  [PlayerColor.RED]: '#8b2500',
  [PlayerColor.GREEN]: '#2a6a3a',
  [PlayerColor.YELLOW]: '#9a7a1a',
};

interface ScoreTrackProps {
  players: PlayerState[];
  currentPlayerId: string;
}

export function ScoreTrack({ players, currentPlayerId }: ScoreTrackProps) {
  const sorted = [...players].sort((a, b) => b.notoriety - a.notoriety);

  return (
    <div className="hud-panel score-track">
      <div className="score-track__header">
        <span className="score-track__title">Notoriety</span>
        <span className="score-track__goal">{WINNING}</span>
      </div>

      {/* Milestone + tick ruler area */}
      <div className="score-track__ruler">
        {/* Tick marks */}
        {Array.from({ length: WINNING + 1 }, (_, i) => (
          <div
            key={i}
            className={`score-track__tick ${i % 6 === 0 ? 'score-track__tick--major' : ''}`}
            style={{ left: `${(i / WINNING) * 100}%` }}
          >
            {i % 6 === 0 && <span className="score-track__tick-label">{i}</span>}
          </div>
        ))}

        {/* Milestone markers */}
        {MILESTONES.map(m => (
          <div
            key={m.at}
            className="score-track__milestone"
            style={{ left: `${(m.at / WINNING) * 100}%` }}
            title={`${m.at}: ${m.label}`}
          >
            <div className="score-track__milestone-line" />
            <span className="score-track__milestone-icon">{m.icon}</span>
          </div>
        ))}
      </div>

      {/* Player bars */}
      <div className="score-track__bars">
        {sorted.map(player => {
          const pct = Math.min(100, (player.notoriety / WINNING) * 100);
          const isActive = player.id === currentPlayerId;
          return (
            <div key={player.id} className="score-track__row">
              <div
                className={`score-track__name ${isActive ? 'score-track__name--active' : ''}`}
                style={{ color: COLOR_DARK[player.color] }}
              >
                {player.name.split(' ').pop()}
              </div>
              <div className="score-track__bar-bg">
                {/* Milestone zone lines inside bar area */}
                {MILESTONES.map(m => (
                  <div
                    key={m.at}
                    className="score-track__bar-milestone"
                    style={{ left: `${(m.at / WINNING) * 100}%` }}
                  />
                ))}

                <div
                  className="score-track__bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${COLOR_DARK[player.color]}, ${COLOR_HEX[player.color]})`,
                  }}
                />
                {player.notoriety > 0 && (
                  <span
                    className="score-track__bar-value"
                    style={{
                      left: `${Math.max(pct, 6)}%`,
                      color: pct > 15 ? '#f4e8c1' : COLOR_DARK[player.color],
                    }}
                  >
                    {player.notoriety}
                  </span>
                )}
                {player.doubloons > 0 && (
                  <span
                    className="score-track__doubloons"
                    style={{ left: `${Math.max(pct, 6)}%` }}
                  >
                    +{player.doubloons}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
