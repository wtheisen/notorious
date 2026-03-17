import React from 'react';
import { WindDirection } from '../../types/GameTypes';
import './hud.css';

interface WindTokenIndicatorProps {
  placeDirection: WindDirection;
}

export function WindTokenIndicator({ placeDirection }: WindTokenIndicatorProps) {
  const isClockwise = placeDirection === WindDirection.CLOCKWISE;
  // PLACE goes in placeDirection, PLAY goes opposite
  const placeArrow = isClockwise ? '↓' : '↑';
  const playArrow = isClockwise ? '↑' : '↓';

  return (
    <div className="wind-token">
      <div className="wind-token__icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Compass rose / wind symbol */}
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.4" />
        </svg>
      </div>
      <div className="wind-token__arrows">
        <span className="wind-token__dir" title="Place phase direction">
          <span className="wind-token__label">Place</span>
          <span className="wind-token__arrow">{placeArrow}</span>
        </span>
        <span className="wind-token__dir" title="Play phase direction">
          <span className="wind-token__label">Play</span>
          <span className="wind-token__arrow">{playArrow}</span>
        </span>
      </div>
    </div>
  );
}
