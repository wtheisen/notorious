import { MCTSBot, RandomBot } from 'boardgame.io/ai';
import { NotoriousState, hexToKey } from '../types/GameState';
import { ActionType, ShipType } from '../../types/GameTypes';
import { HexCoord } from '../../types/CoordinateTypes';
import { getPlayerShips, getHex } from '../logic/BoardLogic';

/**
 * Enumerate all possible moves for the current game state
 * This is used by boardgame.io's AI system to find valid moves
 */
export function enumerateMoves(G: NotoriousState, ctx: any): any[] {
  const moves: any[] = [];
  const playerIndex = parseInt(ctx.currentPlayer);
  const player = G.players[playerIndex];

  // SETUP PHASE: Find valid hexes for port placement
  if (ctx.phase === 'setup') {
    const validHexes = Object.values(G.board.hexes).filter(hex => {
      // Cannot place on island hex
      if (hex.island) return false;

      // Cannot place where another player already has a port
      const otherPlayerHasPort = G.players.some((p, i) =>
        i !== playerIndex && p.portLocation &&
        p.portLocation.q === hex.coord.q && p.portLocation.r === hex.coord.r
      );
      if (otherPlayerHasPort) return false;

      return true;
    });

    for (const hex of validHexes) {
      moves.push({ move: 'placePortAndShips', args: [hex.coord] });
    }
    return moves;
  }

  // PLACE PHASE: Place captains on actions
  if (ctx.phase === 'place') {
    const availableActions = [
      ActionType.BUILD,
      ActionType.SAIL,
      ActionType.STEAL,
      ActionType.SINK,
      ActionType.CHART
    ];

    // Can place captain if we have captains left
    if (player.placedCaptains.length < player.captainCount) {
      for (const action of availableActions) {
        moves.push({ move: 'placeCaptain', args: [action] });
      }
    }
    return moves;
  }

  // PLAY PHASE: Execute actions
  if (ctx.phase === 'play') {
    // Check if player has any captains left to use
    if (player.placedCaptains.length === 0) {
      // No captains - can pass
      moves.push({ move: 'pass', args: [] });
      return moves;
    }

    // Get the next captain's action type
    const nextAction = player.placedCaptains[player.placedCaptains.length - 1];

    switch (nextAction) {
      case ActionType.SAIL:
        // Find all player ships and possible destinations
        const sailMoves = generateSailMoves(G, ctx.currentPlayer);
        moves.push(...sailMoves);
        break;

      case ActionType.BUILD:
        // Find valid build locations
        const buildMoves = generateBuildMoves(G, ctx.currentPlayer, player);
        moves.push(...buildMoves);
        break;

      case ActionType.STEAL:
        // Find hexes where we can steal
        const stealMoves = generateStealMoves(G, ctx.currentPlayer);
        moves.push(...stealMoves);
        break;

      case ActionType.SINK:
        // Find hexes where we can sink
        const sinkMoves = generateSinkMoves(G, ctx.currentPlayer);
        moves.push(...sinkMoves);
        break;

      case ActionType.CHART:
        // CHART action - simple no-bribe version
        moves.push({ move: 'chart', args: [{ bribeChoices: [] }] });
        break;
    }

    // If no valid moves for the action, can pass
    if (moves.length === 0) {
      moves.push({ move: 'pass', args: [] });
    }
    return moves;
  }

  // PIRATE PHASE: Claim charts or pass
  if (ctx.phase === 'pirate') {
    // Check if player can claim any charts
    // For simplicity, just pass for now
    moves.push({ move: 'doneClaiming', args: [] });
    return moves;
  }

  return moves;
}

/**
 * Generate valid SAIL moves
 */
function generateSailMoves(G: NotoriousState, playerId: string): any[] {
  const moves: any[] = [];

  // Find all hexes with player's ships
  const playerHexes = Object.values(G.board.hexes).filter(hex =>
    hex.ships.some(ship => ship.playerId === playerId)
  );

  for (const sourceHex of playerHexes) {
    const playerShips = sourceHex.ships.filter(s => s.playerId === playerId);

    for (const ship of playerShips) {
      // Find adjacent hexes (within 2 distance for simple AI)
      const neighbors = getNeighborHexes(G, sourceHex.coord);

      for (const destCoord of neighbors) {
        moves.push({
          move: 'sail',
          args: [{
            moves: [{
              shipType: ship.type,
              from: sourceHex.coord,
              to: destCoord
            }],
            bribesUsed: 0
          }]
        });
      }
    }
  }

  return moves;
}

/**
 * Generate valid BUILD moves
 */
function generateBuildMoves(G: NotoriousState, playerId: string, player: any): any[] {
  const moves: any[] = [];

  // Find valid build locations (port or where we have ships without enemies)
  const validHexes = Object.values(G.board.hexes).filter(hex => {
    const playerShips = hex.ships.filter(s => s.playerId === playerId);
    const enemyShips = hex.ships.filter(s => s.playerId !== playerId);

    const isPort = player.portLocation &&
      player.portLocation.q === hex.coord.q &&
      player.portLocation.r === hex.coord.r;

    return (playerShips.length > 0 || isPort) && enemyShips.length === 0;
  });

  for (const hex of validHexes) {
    // Build 2 sloops (default)
    if (player.ships.sloops >= 2) {
      moves.push({
        move: 'build',
        args: [{
          hex: hex.coord,
          placements: [ShipType.SLOOP, ShipType.SLOOP],
          bribesUsed: 0
        }]
      });
    }

    // Build 1 galleon
    if (player.ships.galleons >= 1) {
      moves.push({
        move: 'build',
        args: [{
          hex: hex.coord,
          placements: [ShipType.GALLEON],
          bribesUsed: 0
        }]
      });
    }
  }

  return moves;
}

/**
 * Generate valid STEAL moves
 */
function generateStealMoves(G: NotoriousState, playerId: string): any[] {
  const moves: any[] = [];

  // Find hexes where we have ships AND opponent has sloops
  const stealHexes = Object.values(G.board.hexes).filter(hex => {
    const playerShips = hex.ships.filter(s => s.playerId === playerId);
    const enemySloops = hex.ships.filter(s => s.playerId !== playerId && s.type === ShipType.SLOOP);
    return playerShips.length > 0 && enemySloops.length > 0;
  });

  for (const hex of stealHexes) {
    const enemySloops = hex.ships.filter(s => s.playerId !== playerId && s.type === ShipType.SLOOP);
    if (enemySloops.length > 0) {
      moves.push({
        move: 'steal',
        args: [{
          hex: hex.coord,
          targetPlayerId: enemySloops[0].playerId,
          replaceWithSloop: true
        }]
      });
    }
  }

  return moves;
}

/**
 * Generate valid SINK moves
 */
function generateSinkMoves(G: NotoriousState, playerId: string): any[] {
  const moves: any[] = [];

  // Find hexes where we have ships AND opponent has any ships
  const sinkHexes = Object.values(G.board.hexes).filter(hex => {
    const playerShips = hex.ships.filter(s => s.playerId === playerId);
    const enemyShips = hex.ships.filter(s => s.playerId !== playerId);
    return playerShips.length > 0 && enemyShips.length > 0;
  });

  for (const hex of sinkHexes) {
    const enemyShips = hex.ships.filter(s => s.playerId !== playerId);
    if (enemyShips.length > 0) {
      const target = enemyShips[0];
      moves.push({
        move: 'sink',
        args: [{
          hex: hex.coord,
          targetShipType: target.type,
          targetPlayerId: target.playerId,
          sloopMovesBefore: [],
          additionalSinks: []
        }]
      });
    }
  }

  return moves;
}

/**
 * Get neighboring hexes (simple distance-1 neighbors)
 */
function getNeighborHexes(G: NotoriousState, coord: HexCoord): HexCoord[] {
  const directions = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
  ];

  return directions
    .map(d => ({ q: coord.q + d.q, r: coord.r + d.r, s: -(coord.q + d.q) - (coord.r + d.r) }))
    .filter(c => G.board.hexes[hexToKey(c)] !== undefined);
}

/**
 * Create a RandomBot for Notorious
 */
export function createNotoriousBot() {
  return new RandomBot({
    enumerate: enumerateMoves,
    seed: Date.now().toString()
  });
}
