import { MCTSBot, RandomBot } from 'boardgame.io/ai';
import { NotoriousState, hexToKey } from '../types/GameState';
import { ActionType, ShipType, ChartType, GAME_CONSTANTS } from '../../types/GameTypes';
import { HexCoord, hexEquals } from '../../types/CoordinateTypes';
import { getPlayerShips, getHex, getHexController, getIslandByName, findPathOnBoard } from '../logic/BoardLogic';
import { getValidNeighbors } from '../../config/HexConstants';
import { TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../../core/Chart';

/**
 * Enumerate all possible moves for the current game state
 * This is used by boardgame.io's AI system to find valid moves
 */
export function enumerateMoves(G: NotoriousState, ctx: any): any[] {
  const moves: any[] = [];
  const playerIndex = parseInt(ctx.currentPlayer);
  const player = G.players[playerIndex];

  // SETUP PHASE: Snake draft - place port+sloops or galleon+sloops
  if (ctx.phase === 'setup') {
    const needsPort = !player.portLocation;
    const moveName = needsPort ? 'placePortAndShips' : 'placeGalleonAndShips';

    const validHexes = Object.values(G.board.hexes).filter(hex => {
      if (hex.island) return false;
      return hex.ships.length === 0;
    });

    for (const hex of validHexes) {
      moves.push({ move: moveName, args: [hex.coord] });
    }
    return moves;
  }

  // PLACE PHASE: Place captains on actions
  // AI can place on any action - if it can't execute later, it's a missed action
  if (ctx.phase === 'place') {
    if (player.placedCaptains.length < player.captainCount) {
      const allActions = [
        ActionType.SAIL,
        ActionType.BUILD,
        ActionType.STEAL,
        ActionType.SINK,
        ActionType.CHART
      ];

      for (const action of allActions) {
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

    // If no valid moves for the action, skip it (forfeit the captain)
    if (moves.length === 0) {
      moves.push({ move: 'skipAction', args: [] });
    }
    return moves;
  }

  // PIRATE PHASE: Claim charts, set wind token, or done
  if (ctx.phase === 'pirate') {
    // If this AI holds the wind token, set it (keep direction, advance position by 1)
    if (G.windToken.holder === ctx.currentPlayer) {
      const newPos = (G.windToken.position + 1) % ctx.numPlayers;
      moves.push({ move: 'setWindToken', args: [{ flip: false, newPosition: newPos }] });
    }

    // Try to claim charts from hand
    const claimMoves = generateClaimMoves(G, ctx.currentPlayer, player);
    moves.push(...claimMoves);

    // Always include doneClaiming as a fallback
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
    // Fix #2: Filter out PORT ships — they can't be sailed
    const playerShips = sourceHex.ships.filter(
      s => s.playerId === playerId && s.type !== ShipType.PORT
    );

    for (const ship of playerShips) {
      // Fix #3: Use getValidNeighbors for wrap-aware neighbors
      const neighbors = getValidNeighbors(sourceHex.coord)
        .filter(c => G.board.hexes[hexToKey(c)] !== undefined);

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
  const player = G.players.find(p => p.id === playerId);
  const hasSloops = player && player.ships.sloops > 0;

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
          replaceWithSloop: hasSloops ? true : false
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
    const enemyShips = hex.ships.filter(s => s.playerId !== playerId && s.type !== ShipType.PORT);
    return playerShips.length > 0 && enemyShips.length > 0;
  });

  for (const hex of sinkHexes) {
    const enemyShips = hex.ships.filter(s => s.playerId !== playerId && s.type !== ShipType.PORT);
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
 * Generate valid chart claim moves for the Pirate phase (Fix #1)
 * Checks Treasure Maps, Smuggler Routes in hand, and public Island Raids
 */
function generateClaimMoves(G: NotoriousState, playerId: string, player: any): any[] {
  const moves: any[] = [];

  // Check charts in hand
  for (const chart of player.charts) {
    switch (chart.type) {
      case ChartType.TREASURE_MAP: {
        const tm = chart as TreasureMapChart;
        const playerShips = getPlayerShips(G.board, tm.targetHex, playerId);
        const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
        const controller = getHexController(G.board, tm.targetHex);
        if (hasGalleon && controller === playerId) {
          moves.push({ move: 'claimChart', args: [{ chartId: chart.id }] });
        }
        break;
      }
      case ChartType.SMUGGLER_ROUTE: {
        const sr = chart as SmugglerRouteChart;
        const islandA = getIslandByName(G.board, sr.islandA);
        const islandB = getIslandByName(G.board, sr.islandB);
        if (!islandA || !islandB) break;
        const path = findPathOnBoard(G.board, islandA.hexCoord, islandB.hexCoord);
        if (path.length === 0) break;
        // Check player has ships on every hex of the path
        const allCovered = path.every(h => {
          const hex = getHex(G.board, h);
          return hex?.ships.some(s => s.playerId === playerId);
        });
        if (allCovered) {
          moves.push({ move: 'claimChart', args: [{ chartId: chart.id }] });
        }
        break;
      }
    }
  }

  // Check public Island Raids
  const maxNotoriety = Math.max(...G.players.map(p => p.notoriety));
  for (let i = 0; i < G.chartDeck.islandRaids.length; i++) {
    const raid = G.chartDeck.islandRaids[i] as IslandRaidChart;
    const threshold = raid.claimThreshold;
    if (maxNotoriety < threshold) continue;

    // Find the island hex
    const island = getIslandByName(G.board, raid.targetIsland);
    if (!island) continue;

    const playerShips = getPlayerShips(G.board, island.hexCoord, playerId);
    const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
    const controller = getHexController(G.board, island.hexCoord);
    if (hasGalleon && controller === playerId) {
      moves.push({ move: 'claimChart', args: [{ chartId: raid.id }] });
    }
  }

  return moves;
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
