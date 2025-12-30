import React from 'react';
import { NotoriousState, hexToKey, Ship } from '../game/types/GameState';
import { HexCoord, hexEquals } from '../types/CoordinateTypes';
import { hexToPixel, getHexCorners, hexDistance } from '../utils/HexMath';
import { getHexController, getPlayerShips, canSailBetween, getNeighbors, getHex } from '../game/logic/BoardLogic';
import { ShipRenderer } from './ShipRenderer';
import { ActionType, ShipType } from '../types/GameTypes';
import { getPowerStrategy } from '../core/powers';
import { SailState } from '../App';

interface BoardProps {
  G: NotoriousState;
  ctx: any;
  moves: any;
  playerID?: string | null;  // Optional - defaults to "0" (human player)
  selectedAction: ActionType | null;
  selectedHex: HexCoord | null;
  onHexClick: (coord: HexCoord) => void;
  sailState: SailState;
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
 * Get all valid sail destinations for a ship at a given hex
 * Takes into account the player's power and remaining movement points
 */
function getValidSailDestinations(
  G: NotoriousState,
  sourceHex: HexCoord,
  playerID: string,
  remainingMovementPoints: number
): Set<string> {
  const validDestinations = new Set<string>();
  const player = G.players.find(p => p.id === playerID);
  if (!player || remainingMovementPoints <= 0) return validDestinations;

  const power = getPowerStrategy(player.piratePower);

  // Helper to check if sailing is valid between two hexes for this player
  const canSailForPlayer = (from: HexCoord, to: HexCoord): boolean => {
    return power.canSailBetween(G.board, from, to, () => canSailBetween(G.board, from, to));
  };

  // BFS to find all reachable hexes within remaining movement points
  const visited = new Set<string>();
  const queue: Array<{ coord: HexCoord; distance: number }> = [{ coord: sourceHex, distance: 0 }];
  visited.add(hexToKey(sourceHex));

  while (queue.length > 0) {
    const { coord, distance } = queue.shift()!;

    if (distance >= remainingMovementPoints) continue;

    const neighbors = getNeighbors(G.board, coord);
    for (const neighbor of neighbors) {
      const key = hexToKey(neighbor.coord);
      if (visited.has(key)) continue;

      if (canSailForPlayer(coord, neighbor.coord)) {
        visited.add(key);
        validDestinations.add(key);
        queue.push({ coord: neighbor.coord, distance: distance + 1 });
      }
    }
  }

  return validDestinations;
}

/**
 * Check if a hex is a valid target for the current action
 */
function isValidHexForAction(
  G: NotoriousState,
  coord: HexCoord,
  action: ActionType | null,
  playerID: string,
  sailState: SailState,
  ctx: any
): { isValid: boolean; isSource: boolean; isDestination: boolean } {
  const result = { isValid: false, isSource: false, isDestination: false };
  if (!action || ctx?.phase !== 'play') return result;

  const playerShips = getPlayerShips(G.board, coord, playerID);
  const player = G.players.find(p => p.id === playerID);

  switch (action) {
    case ActionType.BUILD: {
      const hasShips = playerShips.length > 0;
      const isPort = player?.portLocation && hexEquals(player.portLocation, coord);
      const hex = G.board.hexes[hexToKey(coord)];
      const hasEnemyShips = hex?.ships.some(s => s.playerId !== playerID) ?? false;
      result.isValid = (hasShips || isPort) && (!hasEnemyShips || isPort);
      return result;
    }

    case ActionType.STEAL: {
      if (playerShips.length === 0) return result;
      const hex = G.board.hexes[hexToKey(coord)];
      result.isValid = hex?.ships.some(s => s.playerId !== playerID && s.type === ShipType.SLOOP) ?? false;
      return result;
    }

    case ActionType.SINK: {
      if (playerShips.length === 0) return result;
      const hex = G.board.hexes[hexToKey(coord)];
      result.isValid = hex?.ships.some(s => s.playerId !== playerID) ?? false;
      return result;
    }

    case ActionType.SAIL: {
      // Step 1: No ship selected - highlight hexes with player's ships (sources)
      if (!sailState.selectedShip) {
        const hasMovableShips = playerShips.filter(s => s.type !== ShipType.PORT).length > 0;
        if (hasMovableShips) {
          result.isValid = true;
          result.isSource = true;
        }
        return result;
      }

      // Step 2: Ship selected - highlight valid destinations based on remaining movement points
      if (sailState.sourceHex && player) {
        const power = getPowerStrategy(player.piratePower);
        const baseMovementPoints = power.getSailMaxDistance();
        const totalMovementPoints = baseMovementPoints + sailState.bribeCount;

        // Calculate movement points already used
        const usedMovementPoints = sailState.plannedMoves.reduce((sum, move) => {
          return sum + hexDistance(move.from, move.to);
        }, 0);

        const remainingPoints = totalMovementPoints - usedMovementPoints;

        const validDestinations = getValidSailDestinations(G, sailState.sourceHex, playerID, remainingPoints);
        if (validDestinations.has(hexToKey(coord))) {
          result.isValid = true;
          result.isDestination = true;
        }
      }
      return result;
    }

    case ActionType.CHART:
      return result;

    default:
      return result;
  }
}

/**
 * Main Board component - renders the hex grid with SVG
 */
export const Board: React.FC<BoardProps> = ({
  G, ctx, moves, playerID, selectedAction, selectedHex, onHexClick, sailState
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
        const isSourceHex = sailState.sourceHex && hexEquals(sailState.sourceHex, hex.coord);

        // Check if this hex is a valid target for current action or setup
        let actionResult = { isValid: false, isSource: false, isDestination: false };
        if (ctx.phase === 'setup' && ctx.currentPlayer === effectivePlayerID) {
          actionResult.isValid = isValidHexForSetup(G, hex.coord, effectivePlayerID);
        } else if (ctx.phase === 'play' && ctx.currentPlayer === effectivePlayerID && selectedAction) {
          actionResult = isValidHexForAction(G, hex.coord, selectedAction, effectivePlayerID, sailState, ctx);
        }

        // Determine visual styling
        let fillColor = baseFillColor;
        let strokeColor = '#333';
        let strokeWidth = 2;
        let opacity = 0.6;

        if (isSourceHex) {
          // Currently selected source hex for sailing
          strokeColor = '#FFD700';  // Gold
          strokeWidth = 4;
          opacity = 1;
        } else if (isSelected) {
          strokeColor = '#FFD700';
          strokeWidth = 3;
        } else if (actionResult.isDestination) {
          // Valid destination for sailing
          strokeColor = '#00FF00';  // Green
          strokeWidth = 3;
          opacity = 0.9;
          fillColor = '#2E7D32';  // Darker green tint
        } else if (actionResult.isSource) {
          // Source hex (has movable ships)
          strokeColor = '#FFA500';  // Orange
          strokeWidth = 2;
          opacity = 0.85;
        } else if (actionResult.isValid) {
          // Valid for other actions
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
