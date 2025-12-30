import React from 'react';
import { Ship } from '../game/types/GameState';
import { ShipType, PlayerColor } from '../types/GameTypes';

interface ShipRendererProps {
  ship: Ship;
  position: { x: number; y: number };
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
export const ShipRenderer: React.FC<ShipRendererProps> = ({ ship, position }) => {
  const color = getPlayerColorHex(ship.playerId);

  if (ship.type === ShipType.PORT) {
    return (
      <rect
        x={position.x - 10}
        y={position.y - 10}
        width={20}
        height={20}
        fill={color}
        stroke="#000"
        strokeWidth="2"
      />
    );
  }

  if (ship.type === ShipType.GALLEON) {
    return (
      <circle
        cx={position.x}
        cy={position.y}
        r={8}
        fill={color}
        stroke="#000"
        strokeWidth="2"
      />
    );
  }

  // Sloop - triangle pointing up
  const points = `${position.x},${position.y - 6} ${position.x - 5},${position.y + 6} ${position.x + 5},${position.y + 6}`;
  return (
    <polygon
      points={points}
      fill={color}
      stroke="#000"
      strokeWidth="2"
    />
  );
};
