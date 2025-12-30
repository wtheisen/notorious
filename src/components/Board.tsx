import React from 'react';
import { NotoriousState, hexToKey } from '../game/types/GameState';
import { HexCoord, hexEquals } from '../types/CoordinateTypes';
import { hexToPixel, getHexCorners, hexDistance } from '../utils/HexMath';
import { getHexController, getPlayerShips, canSailBetween } from '../game/logic/BoardLogic';
import { ShipRenderer } from './ShipRenderer';
import { ActionType, ShipType } from '../types/GameTypes';

interface BoardProps {
  G: NotoriousState;
  ctx: any;
  moves: any;
  playerID?: string | null;  // Optional - defaults to "0" (human player)
  selectedAction: ActionType | null;
  selectedHex: HexCoord | null;
  onHexClick: (coord: HexCoord) => void;
}

/**
 * Get color for a player
 */
function getPlayerColor(playerId: string): string {
  const colors: Record<string, string> = {
    '0': '#4A90E2',  // Blue
    '1': '#E24A4A',  // Red
    '2': '#4AE290',  // Green
    '3': '#E2D24A'   // Yellow
  };
  return colors[playerId] || '#888888';
}

/**
 * Calculate ship position within a hex
 * Distributes ships in a circle around the hex center
 */
function calculateShipPosition(
  hexCenter: { x: number; y: number },
  shipIndex: number,
  totalShips: number
): { x: number; y: number } {
  if (totalShips === 1) {
    return hexCenter;
  }

  const radius = 15;
  const angle = (2 * Math.PI * shipIndex) / totalShips;
  return {
    x: hexCenter.x + radius * Math.cos(angle),
    y: hexCenter.y + radius * Math.sin(angle)
  };
}

/**
 * Check if a hex is valid for port placement during setup
 */
function isValidHexForSetup(
  G: NotoriousState,
  coord: HexCoord,
  playerID: string
): boolean {
  const hex = G.board.hexes[hexToKey(coord)];
  if (!hex) return false;

  // Cannot place on island hex
  if (hex.island) return false;

  // Cannot place where another player already has a port
  const otherPlayerHasPort = G.players.some((p, i) =>
    p.id !== playerID && p.portLocation && hexEquals(p.portLocation, coord)
  );
  if (otherPlayerHasPort) return false;

  return true;
}

/**
 * Check if a hex is a valid target for the current action
 */
function isValidHexForAction(
  G: NotoriousState,
  coord: HexCoord,
  action: ActionType | null,
  playerID: string,
  selectedHex: HexCoord | null,
  ctx: any
): boolean {
  if (!action || ctx?.phase !== 'play') return false;

  const playerShips = getPlayerShips(G.board, coord, playerID);
  const player = G.players.find(p => p.id === playerID);

  switch (action) {
    case ActionType.BUILD: {
      // Valid if player has ships there OR it's their port
      const hasShips = playerShips.length > 0;
      const isPort = player?.portLocation && hexEquals(player.portLocation, coord);
      // Also check no enemy ships (unless it's port)
      const hex = G.board.hexes[hexToKey(coord)];
      const hasEnemyShips = hex?.ships.some(s => s.playerId !== playerID) ?? false;
      return (hasShips || isPort) && (!hasEnemyShips || isPort);
    }

    case ActionType.STEAL: {
      // Valid if player has ships there AND opponent has sloop there
      if (playerShips.length === 0) return false;
      const hex = G.board.hexes[hexToKey(coord)];
      return hex?.ships.some(s => s.playerId !== playerID && s.type === ShipType.SLOOP) ?? false;
    }

    case ActionType.SINK: {
      // Valid if player has ships there AND opponent has any ship there
      if (playerShips.length === 0) return false;
      const hex = G.board.hexes[hexToKey(coord)];
      return hex?.ships.some(s => s.playerId !== playerID) ?? false;
    }

    case ActionType.SAIL: {
      // If no hex selected, valid if player has ships there
      if (!selectedHex) {
        return playerShips.length > 0;
      }
      // If hex selected, valid if it's reachable (within 2 hexes and path is valid)
      const distance = hexDistance(selectedHex, coord);
      if (distance === 0) return false;
      if (distance > 2) return false;
      if (distance === 1) return canSailBetween(G.board, selectedHex, coord);
      // For distance 2, we'd need to check intermediate paths
      return distance <= 2;
    }

    case ActionType.CHART:
      // CHART doesn't need hex selection
      return false;

    default:
      return false;
  }
}

/**
 * Main Board component - renders the hex grid with SVG
 */
export const Board: React.FC<BoardProps> = ({
  G, ctx, moves, playerID, selectedAction, selectedHex, onHexClick
}) => {
  // Default to player 0 (human player) if playerID not provided
  const effectivePlayerID = playerID ?? '0';

  const centerX = 400;
  const centerY = 300;
  const svgWidth = 800;
  const svgHeight = 600;

  const handleHexClick = (coord: HexCoord) => {
    onHexClick(coord);
    console.log('Hex clicked:', coord, 'Action:', selectedAction);
  };

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      style={{
        border: '2px solid #333',
        backgroundColor: '#1a1a2e',
        display: 'block'
      }}
    >
      {/* Render all hexes */}
      {Object.values(G.board.hexes).map(hex => {
        const pixel = hexToPixel(hex.coord, centerX, centerY);
        const corners = getHexCorners(pixel);
        const pathData = corners.map((c, i) =>
          `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`
        ).join(' ') + ' Z';

        const controller = getHexController(G.board, hex.coord);
        const baseFillColor = controller
          ? getPlayerColor(controller)
          : '#e0e0e0';

        const isSelected = selectedHex && hexEquals(selectedHex, hex.coord);

        // Check if this hex is a valid target for current action or setup
        let isValidTarget = false;
        if (ctx.phase === 'setup' && ctx.currentPlayer === effectivePlayerID) {
          isValidTarget = isValidHexForSetup(G, hex.coord, effectivePlayerID);
        } else if (ctx.phase === 'play' && ctx.currentPlayer === effectivePlayerID && selectedAction) {
          isValidTarget = isValidHexForAction(G, hex.coord, selectedAction, effectivePlayerID, selectedHex, ctx);
        }

        // Determine visual styling
        let fillColor = baseFillColor;
        let strokeColor = '#333';
        let strokeWidth = 2;
        let opacity = 0.6;

        if (isSelected) {
          strokeColor = '#FFD700';
          strokeWidth = 3;
        } else if (isValidTarget) {
          strokeColor = '#00FF00';
          strokeWidth = 3;
          opacity = 0.8;
        }

        return (
          <g
            key={hexToKey(hex.coord)}
            onClick={() => handleHexClick(hex.coord)}
            style={{ cursor: 'pointer' }}
          >
            {/* Hex polygon */}
            <path
              d={pathData}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              opacity={opacity}
            />

            {/* Island if present */}
            {hex.island && (
              <>
                <circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r={25}
                  fill="#8B4513"
                  stroke="#654321"
                  strokeWidth="2"
                />
                <text
                  x={pixel.x}
                  y={pixel.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#FFF"
                  fontSize="10"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {hex.island.name.substring(0, 3)}
                </text>
              </>
            )}

            {/* Port indicator - check if any player has port here */}
            {G.players.map(p => {
              if (p.portLocation && hexEquals(p.portLocation, hex.coord)) {
                return (
                  <ShipRenderer
                    key={`port-${p.id}`}
                    ship={{ type: ShipType.PORT, playerId: p.id }}
                    position={{ x: pixel.x - 25, y: pixel.y - 20 }}
                  />
                );
              }
              return null;
            })}

            {/* Ships */}
            {hex.ships.map((ship, index) => {
              const shipPos = calculateShipPosition(pixel, index, hex.ships.length);
              return (
                <ShipRenderer
                  key={`${ship.playerId}-${ship.type}-${index}`}
                  ship={ship}
                  position={shipPos}
                />
              );
            })}

            {/* Coordinate label for debugging */}
            <text
              x={pixel.x}
              y={pixel.y + 35}
              textAnchor="middle"
              fill="#666"
              fontSize="8"
              pointerEvents="none"
            >
              {hex.coord.q},{hex.coord.r}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <text x="10" y="20" fill="#FFF" fontSize="14" fontWeight="bold">
        Notorious - Hex Board
      </text>
      <text x="10" y="40" fill="#FFF" fontSize="12">
        Phase: {ctx.phase}
      </text>
      <text x="10" y="60" fill="#FFF" fontSize="12">
        Current Player: Player {parseInt(ctx.currentPlayer) + 1}
      </text>
    </svg>
  );
};
