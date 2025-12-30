import React from 'react';
import { Ship } from '../game/types/GameState';
import { ShipType, PlayerColor } from '../types/GameTypes';

interface ShipRendererProps {
  ship: Ship;
  position: { x: number; y: number };
  isClickable?: boolean;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Get hex color string for a player color
 */
function getPlayerColorHex(playerId: string): string {
  // Simple color mapping based on player ID
  const colors: Record<string, string> = {
    '0': '#4A90E2',  // Blue
    '1': '#E24A4A',  // Red
    '2': '#4AE290',  // Green
    '3': '#E2D24A'   // Yellow
  };
  return colors[playerId] || '#888888';
}

/**
 * Renders a single ship as SVG
 * - Port: Rectangle/Square
 * - Galleon: Large circle
 * - Sloop: Triangle
 */
export const ShipRenderer: React.FC<ShipRendererProps> = ({
  ship,
  position,
  isClickable = false,
  isSelected = false,
  onClick
}) => {
  const color = getPlayerColorHex(ship.playerId);
  const strokeColor = isSelected ? '#FFD700' : '#000';
  const strokeWidth = isSelected ? 3 : 2;

  // Common props for interactive elements
  const interactiveProps = {
    onClick,
    style: {
      cursor: isClickable ? 'pointer' : 'default',
      filter: isClickable ? 'drop-shadow(0 0 3px rgba(255, 215, 0, 0.8))' : undefined
    } as React.CSSProperties
  };

  if (ship.type === ShipType.PORT) {
    return (
      <rect
        x={position.x - 10}
        y={position.y - 10}
        width={20}
        height={20}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    );
  }

  if (ship.type === ShipType.GALLEON) {
    return (
      <circle
        cx={position.x}
        cy={position.y}
        r={isClickable ? 10 : 8}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        {...interactiveProps}
      />
    );
  }

  // Sloop - triangle pointing up
  const size = isClickable ? 8 : 6;
  const points = `${position.x},${position.y - size} ${position.x - size},${position.y + size} ${position.x + size},${position.y + size}`;
  return (
    <polygon
      points={points}
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      {...interactiveProps}
    />
  );
};
