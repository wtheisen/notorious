import { Game, Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { NotoriousState, PlayerState, BoardState, hexToKey, Ship } from './types/GameState';
import { PlayerColor, ActionType, WindDirection, GAME_CONSTANTS, ShipType, PiratePower } from '../types/GameTypes';
import { getPowerStrategy } from '../core/powers';
import { HexCoord, hexEquals } from '../types/CoordinateTypes';
import {
  gainNotoriety,
  placeCaptain,
  spendDoubloons,
  hasPlayerWon,
  addChart,
  hasShips,
  spendShips,
  returnShips,
  gainDoubloons,
  setPortLocation
} from './logic/PlayerLogic';
import {
  createEmptyBoard,
  getControlledHexes,
  placeIsland,
  placeShip,
  getHex,
  getPlayerShips,
  removeShip,
  moveShip,
  canSailBetween,
  getInfluence,
  getNeighbors,
  getAllIslands,
  getIslandByName,
  getHexController,
  findPathOnBoard,
  getAllHexes
} from './logic/BoardLogic';
import { IslandPlacer } from '../core/IslandPlacer';
import { ChartFactory, AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../core/Chart';
import { ChartType } from '../types/GameTypes';
import { BOARD_HEXES } from '../config/HexConstants';
import { hexDistance } from '../utils/HexMath';

// ============================================
// Move Data Types
// ============================================

/** Data for a single ship movement */
interface ShipMove {
  shipType: ShipType;
  from: HexCoord;
  to: HexCoord;
}

/** SAIL action move data */
interface SailMoveData {
  moves: ShipMove[];
  bribesUsed: number;
}

/** BUILD action move data */
interface BuildMoveData {
  hex: HexCoord;
  placements: ShipType[];  // e.g., [SLOOP, SLOOP] or [GALLEON]
  bribesUsed: number;
}

/** STEAL action move data */
interface StealMoveData {
  hex: HexCoord;
  targetPlayerId: string;
  replaceWithSloop: boolean;  // Whether to place your sloop as replacement
}

/** SINK action move data */
interface SinkMoveData {
  hex: HexCoord;
  targetShipType: ShipType;
  targetPlayerId: string;
  bribesUsed: number;
  moveSloopBefore?: { from: HexCoord; to: HexCoord };  // Bribe 1
  additionalSink?: { shipType: ShipType; playerId: string };  // Bribe 2
}

/** CHART action move data */
interface ChartMoveData {
  bribesUsed: number;
  drawExtra: boolean;  // Bribe 1: draw 3 instead of 2
  keepExtra: boolean;  // Bribe 2: keep 2 instead of 1
  selectedChartIds?: string[];  // Charts to keep (if selection phase)
}

/** CLAIM CHART move data (used during Pirate phase) */
interface ClaimChartData {
  chartId: string;
}

/**
 * Main boardgame.io Game definition for Notorious
 */
export const NotoriousGame: Game<NotoriousState> = {
  name: 'notorious',

  /**
   * Initialize the game state
   */
  setup: ({ ctx, random }): NotoriousState => {
    console.log('[NotoriousGame] Setting up game');

    // Randomly assign pirate powers to players
    const allPowers = [
      PiratePower.THE_SAILOR,
      PiratePower.THE_PEACEFUL,
      PiratePower.THE_RELENTLESS,
      PiratePower.THE_ISLANDER
    ];
    const shuffledPowers = random!.Shuffle([...allPowers]);

    // Create players
    const players: PlayerState[] = ctx.playOrder.map((id, index) => {
      const colors = [PlayerColor.BLUE, PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW];
      const power = shuffledPowers[index % shuffledPowers.length];
      console.log(`[NotoriousGame] Player ${index + 1} assigned power: ${power}`);
      return {
        id,
        name: `Player ${parseInt(id) + 1}`,
        color: colors[index] || PlayerColor.BLUE,
        isAI: false,  // Will be set via matchmaking or config
        piratePower: power,

        notoriety: 0,
        doubloons: GAME_CONSTANTS.STARTING_DOUBLOONS,
        captainCount: GAME_CONSTANTS.STARTING_CAPTAINS,
        ships: {
          sloops: GAME_CONSTANTS.STARTING_SLOOPS,
          galleons: GAME_CONSTANTS.STARTING_GALLEONS
        },
        portLocation: null,
        placedCaptains: [],
        charts: []
      };
    });

    // Initialize board
    const board = createEmptyBoard();

    // Place islands - using workaround for Board interface mismatch
    const islandPlacer = new IslandPlacer();
    const islands: any[] = [];

    // Create a simple adapter for island placement
    const boardAdapter = {
      hexes: board.hexes,
      getAllHexes: () => Object.values(board.hexes),
      getHex: (coord: HexCoord) => board.hexes[hexToKey(coord)] || null,
      placeIsland: (island: any) => {
        const hex = board.hexes[hexToKey(island.hexCoord)];
        if (hex) {
          hex.island = island;
          islands.push(island);
          return true;
        }
        return false;
      },
      getIslands: () => islands
    };

    const { islands: placedIslands, remainingTreasureMaps } = islandPlacer.placeIslands(boardAdapter as any);

    console.log(`[NotoriousGame] Placed ${islands.length} islands`);

    // Initialize chart deck
    const allSmugglerRoutes = ChartFactory.createAllSmugglerRoutes();
    const shuffledIslands = random!.Shuffle([...islands]);
    const allIslandRaids = [
      ChartFactory.createIslandRaid(shuffledIslands[0].name as any),
      ChartFactory.createIslandRaid(shuffledIslands[1].name as any)
    ];

    // Create shuffled draw pile from treasure maps and smuggler routes
    const drawPile = random!.Shuffle([
      ...remainingTreasureMaps,
      ...allSmugglerRoutes
    ]);

    const chartDeck = {
      drawPile,
      discardPile: [] as AnyChart[],
      islandRaids: allIslandRaids
    };

    return {
      players,
      board,
      chartDeck,
      windDirection: WindDirection.CLOCKWISE,
      windTokenHolder: null,
      setupComplete: new Array(ctx.numPlayers).fill(false)
    };
  },

  /**
   * Game phases
   */
  phases: {
    // SETUP PHASE: Players place their port and initial ships
    setup: {
      start: true,  // Game starts in SETUP phase

      onBegin: ({ G }) => {
        console.log('[SETUP] Phase started - players will place ports and ships');
      },

      turn: {
        order: {
          first: () => 0,
          next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers
        }
      },

      moves: {
        /**
         * Place port and initial ships in one move
         * Each player places their port on a hex (not on an island, not occupied)
         * and places 2 sloops at that location
         */
        placePortAndShips: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, portHex: HexCoord) => {
          const playerIndex = parseInt(ctx.currentPlayer);
          const player = G.players[playerIndex];

          // Validate: player hasn't already completed setup
          if (G.setupComplete[playerIndex]) {
            console.log('[SETUP] Player already completed setup');
            return INVALID_MOVE;
          }

          // Validate: hex exists
          const hex = getHex(G.board, portHex);
          if (!hex) {
            console.log('[SETUP] Invalid hex coordinate');
            return INVALID_MOVE;
          }

          // Validate: hex doesn't have an island
          if (hex.island) {
            console.log('[SETUP] Cannot place port on island hex');
            return INVALID_MOVE;
          }

          // Validate: hex is not already occupied by another player's port
          const otherPlayerHasPort = G.players.some((p, i) =>
            i !== playerIndex && p.portLocation && hexEquals(p.portLocation, portHex)
          );
          if (otherPlayerHasPort) {
            console.log('[SETUP] Hex already has another player\'s port');
            return INVALID_MOVE;
          }

          // Place the port
          setPortLocation(player, portHex);

          // Place 2 sloops at the port location
          const sloop1: Ship = { type: ShipType.SLOOP, playerId: ctx.currentPlayer };
          const sloop2: Ship = { type: ShipType.SLOOP, playerId: ctx.currentPlayer };
          placeShip(G.board, portHex, sloop1);
          placeShip(G.board, portHex, sloop2);
          spendShips(player, 'sloops', 2);

          // Mark setup complete for this player
          G.setupComplete[playerIndex] = true;

          console.log(`[SETUP] Player ${playerIndex + 1} placed port at (${portHex.q}, ${portHex.r}) with 2 sloops`);

          events?.endTurn();
        }
      },

      endIf: ({ G }) => {
        // End SETUP phase when all players have completed setup
        return G.setupComplete.every(complete => complete);
      },

      next: 'place'
    },

    // PLACE PHASE: Players place captains on action slots
    place: {
      onBegin: ({ G }) => {
        console.log('[PLACE] Phase started');
        // Reset all players' captain placements for new round
        G.players.forEach(p => p.placedCaptains = []);
      },

      turn: {
        order: {
          first: () => 0,
          next: ({ G, ctx }) => {
            // Custom turn order based on wind direction
            if (G.windDirection === WindDirection.CLOCKWISE) {
              return (ctx.playOrderPos + 1) % ctx.numPlayers;
            } else {
              return (ctx.playOrderPos - 1 + ctx.numPlayers) % ctx.numPlayers;
            }
          }
        }
      },

      moves: {
        /**
         * Place a captain on an action slot
         */
        placeCaptain: ({ G, ctx }: { G: NotoriousState; ctx: Ctx }, actionType: ActionType) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          if (!placeCaptain(player, actionType)) {
            return INVALID_MOVE;
          }

          // Auto-end turn after placing captain
          // Note: boardgame.io moves don't have events access, handled automatically
        }
      },

      endIf: ({ G }) => {
        // End PLACE phase when all players have placed all captains
        return G.players.every(p => p.placedCaptains.length >= p.captainCount);
      },

      next: 'play'
    },

    play: {
      onBegin: ({ G }) => {
        console.log('[PLAY] Phase started');
      },

      turn: {
        order: {
          first: () => 0,
          next: ({ G, ctx }) => {
            // Custom turn order based on wind direction
            if (G.windDirection === WindDirection.CLOCKWISE) {
              return (ctx.playOrderPos + 1) % ctx.numPlayers;
            } else {
              return (ctx.playOrderPos - 1 + ctx.numPlayers) % ctx.numPlayers;
            }
          }
        },

        onBegin: ({ G, ctx, events }) => {
          // Skip players with no captains left
          const player = G.players[parseInt(ctx.currentPlayer)];
          if (player.placedCaptains.length === 0) {
            events?.endTurn();
          }
        }
      },

      moves: {
        /**
         * Execute a SAIL action
         * Move 1 ship up to 2 hexes OR 2 ships 1 hex each
         * Bribe: Move an additional ship 1 hex
         * The Sailor: Can move 3 hexes instead of 2
         * The Islander: Can ignore impassable island edges
         */
        sail: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, moveData: SailMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          // Check player has SAIL captain
          const captainIndex = player.placedCaptains.indexOf(ActionType.SAIL);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Validate bribes
          if (moveData.bribesUsed > player.doubloons) {
            console.log('[SAIL] Not enough doubloons for bribes');
            return INVALID_MOVE;
          }

          // Get player's power strategy for sail modifications
          const power = getPowerStrategy(player.piratePower);
          const maxDistance = power.getSailMaxDistance();

          // Helper to check if sailing is valid between two adjacent hexes
          // Power strategy can override this (e.g., Islander ignores island edges)
          const canSailForPlayer = (from: HexCoord, to: HexCoord): boolean => {
            return power.canSailBetween(G.board, from, to, () => canSailBetween(G.board, from, to));
          };

          // Validate each move
          for (const move of moveData.moves) {
            const fromHex = getHex(G.board, move.from);
            const toHex = getHex(G.board, move.to);

            if (!fromHex || !toHex) {
              console.log('[SAIL] Invalid hex coordinates');
              return INVALID_MOVE;
            }

            // Check player has a ship of this type at the source
            const playerShips = getPlayerShips(G.board, move.from, ctx.currentPlayer);
            const hasShip = playerShips.some(s => s.type === move.shipType);
            if (!hasShip) {
              console.log(`[SAIL] No ${move.shipType} at source hex`);
              return INVALID_MOVE;
            }

            // Check path is valid
            const distance = hexDistance(move.from, move.to);
            if (distance === 0) {
              console.log('[SAIL] Cannot sail to same hex');
              return INVALID_MOVE;
            } else if (distance > maxDistance) {
              console.log(`[SAIL] Move distance too far (max ${maxDistance} for ${player.piratePower})`);
              return INVALID_MOVE;
            } else if (distance === 1) {
              if (!canSailForPlayer(move.from, move.to)) {
                console.log('[SAIL] Cannot sail between hexes (blocked by island edge)');
                return INVALID_MOVE;
              }
            } else {
              // For 2+ hex moves, find a valid path
              const neighbors = getNeighbors(G.board, move.from);
              const validPath = neighbors.some(neighbor => {
                if (!canSailForPlayer(move.from, neighbor.coord)) return false;
                const remainingDistance = hexDistance(neighbor.coord, move.to);
                if (remainingDistance === 0) return true;
                if (remainingDistance === 1) return canSailForPlayer(neighbor.coord, move.to);
                if (remainingDistance === 2 && distance === 3) {
                  // For 3-hex moves, need another intermediate
                  const secondNeighbors = getNeighbors(G.board, neighbor.coord);
                  return secondNeighbors.some(n2 => {
                    return canSailForPlayer(neighbor.coord, n2.coord) &&
                      hexDistance(n2.coord, move.to) === 1 &&
                      canSailForPlayer(n2.coord, move.to);
                  });
                }
                return false;
              });
              if (!validPath) {
                console.log(`[SAIL] No valid ${distance}-hex path found`);
                return INVALID_MOVE;
              }
            }
          }

          // Execute: spend doubloons for bribes
          if (moveData.bribesUsed > 0) {
            spendDoubloons(player, moveData.bribesUsed);
          }

          // Execute: move ships
          for (const move of moveData.moves) {
            const ship: Ship = { type: move.shipType, playerId: ctx.currentPlayer };
            // For 2-hex moves, we do it in one step (the validation already confirmed it's valid)
            removeShip(G.board, move.from, ship);
            placeShip(G.board, move.to, ship);
          }

          console.log(`[SAIL] Moved ${moveData.moves.length} ship(s)`);

          // Remove captain
          player.placedCaptains.splice(captainIndex, 1);
          events?.endTurn();
        },

        /**
         * Execute a BUILD action
         * Place 2 Sloops or 1 Galleon in a hex with your pieces (or your port)
         * Bribe: Place an additional Sloop
         */
        build: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, buildData: BuildMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          // Check player has BUILD captain
          const captainIndex = player.placedCaptains.indexOf(ActionType.BUILD);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Validate bribes
          if (buildData.bribesUsed > player.doubloons) {
            console.log('[BUILD] Not enough doubloons for bribes');
            return INVALID_MOVE;
          }

          const hex = getHex(G.board, buildData.hex);
          if (!hex) {
            console.log('[BUILD] Invalid hex coordinate');
            return INVALID_MOVE;
          }

          // Check if hex has player's pieces or is their port
          const playerShips = getPlayerShips(G.board, buildData.hex, ctx.currentPlayer);
          const hasPlayerPieces = playerShips.length > 0;
          const isPortHex = player.portLocation &&
            hexEquals(player.portLocation, buildData.hex);

          if (!hasPlayerPieces && !isPortHex) {
            console.log('[BUILD] Must build in hex with your pieces or port');
            return INVALID_MOVE;
          }

          // Check for enemy pieces (allowed in port hex)
          const allShips = hex.ships;
          const hasEnemyPieces = allShips.some(s => s.playerId !== ctx.currentPlayer);
          if (hasEnemyPieces && !isPortHex) {
            console.log('[BUILD] Cannot build in hex with enemy pieces (except port)');
            return INVALID_MOVE;
          }

          // Validate ship inventory
          const sloopsNeeded = buildData.placements.filter(s => s === ShipType.SLOOP).length;
          const galleonsNeeded = buildData.placements.filter(s => s === ShipType.GALLEON).length;

          if (!hasShips(player, 'sloops', sloopsNeeded)) {
            console.log('[BUILD] Not enough sloops in inventory');
            return INVALID_MOVE;
          }
          if (!hasShips(player, 'galleons', galleonsNeeded)) {
            console.log('[BUILD] Not enough galleons in inventory');
            return INVALID_MOVE;
          }

          // Execute: spend doubloons for bribes
          if (buildData.bribesUsed > 0) {
            spendDoubloons(player, buildData.bribesUsed);
          }

          // Execute: place ships
          for (const shipType of buildData.placements) {
            const ship: Ship = { type: shipType, playerId: ctx.currentPlayer };
            placeShip(G.board, buildData.hex, ship);

            if (shipType === ShipType.SLOOP) {
              spendShips(player, 'sloops', 1);
            } else {
              spendShips(player, 'galleons', 1);
            }
          }

          console.log(`[BUILD] Placed ${buildData.placements.length} ship(s)`);

          // Remove captain
          player.placedCaptains.splice(captainIndex, 1);
          events?.endTurn();
        },

        /**
         * Execute a STEAL action
         * Replace an opponent's Sloop with one of yours in a hex with your pieces
         * No bribes for this action
         */
        steal: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, stealData: StealMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          const captainIndex = player.placedCaptains.indexOf(ActionType.STEAL);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          const hex = getHex(G.board, stealData.hex);
          if (!hex) {
            console.log('[STEAL] Invalid hex coordinate');
            return INVALID_MOVE;
          }

          // Check player has at least one piece in this hex
          const playerShips = getPlayerShips(G.board, stealData.hex, ctx.currentPlayer);
          if (playerShips.length === 0) {
            console.log('[STEAL] You have no pieces in this hex');
            return INVALID_MOVE;
          }

          // Check target has a sloop in this hex
          const targetShips = getPlayerShips(G.board, stealData.hex, stealData.targetPlayerId);
          const hasSloop = targetShips.some(s => s.type === ShipType.SLOOP);
          if (!hasSloop) {
            console.log('[STEAL] Target has no sloop in this hex');
            return INVALID_MOVE;
          }

          // Check player has a sloop to place (if they want to replace)
          if (stealData.replaceWithSloop && !hasShips(player, 'sloops', 1)) {
            console.log('[STEAL] No sloop to place as replacement');
            return INVALID_MOVE;
          }

          // Execute: remove opponent's sloop
          const sloopToRemove: Ship = { type: ShipType.SLOOP, playerId: stealData.targetPlayerId };
          removeShip(G.board, stealData.hex, sloopToRemove);

          // Return ship to opponent's inventory
          const opponent = G.players.find(p => p.id === stealData.targetPlayerId);
          if (opponent) {
            returnShips(opponent, 'sloops', 1);

            // Trigger opponent's power passive (e.g., The Peaceful gains doubloon)
            const opponentPower = getPowerStrategy(opponent.piratePower);
            opponentPower.onShipStolen(opponent, player);
          }

          // Place player's sloop if requested
          if (stealData.replaceWithSloop) {
            const newSloop: Ship = { type: ShipType.SLOOP, playerId: ctx.currentPlayer };
            placeShip(G.board, stealData.hex, newSloop);
            spendShips(player, 'sloops', 1);
          }

          console.log(`[STEAL] Stole sloop from player ${stealData.targetPlayerId}`);

          player.placedCaptains.splice(captainIndex, 1);
          events?.endTurn();
        },

        /**
         * Execute a SINK action
         * Remove opponent's ship in a hex with your pieces
         * Gain notoriety if opponent is at least as notorious as you
         * Bribe 1: Move a sloop 1 hex before sinking
         * Bribe 2: Sink an additional ship in the same hex
         * The Peaceful: Cannot use this action
         * The Relentless: Free sloop move before sinking (no bribe needed)
         */
        sink: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, sinkData: SinkMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];
          const power = getPowerStrategy(player.piratePower);

          // Check if power allows SINK action (e.g., The Peaceful cannot)
          if (!power.canUseSink()) {
            console.log('[SINK] Power prevents using Sink action');
            return INVALID_MOVE;
          }

          const captainIndex = player.placedCaptains.indexOf(ActionType.SINK);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Apply power's cost modification (e.g., Relentless gets free sloop move)
          const actualBribesUsed = power.modifySinkCost(sinkData.bribesUsed, {
            movingSloop: !!sinkData.moveSloopBefore
          });

          // Validate bribes
          if (actualBribesUsed > player.doubloons) {
            console.log('[SINK] Not enough doubloons for bribes');
            return INVALID_MOVE;
          }

          // Validate sloop movement (used by bribe or Relentless power)
          if (sinkData.moveSloopBefore) {
            const fromHex = getHex(G.board, sinkData.moveSloopBefore.from);
            const toHex = getHex(G.board, sinkData.moveSloopBefore.to);

            if (!fromHex || !toHex) {
              console.log('[SINK] Invalid sloop movement hexes');
              return INVALID_MOVE;
            }

            if (!canSailBetween(G.board, sinkData.moveSloopBefore.from, sinkData.moveSloopBefore.to)) {
              console.log('[SINK] Cannot move sloop along this path');
              return INVALID_MOVE;
            }

            const hasSloop = getPlayerShips(G.board, sinkData.moveSloopBefore.from, ctx.currentPlayer)
              .some(s => s.type === ShipType.SLOOP);
            if (!hasSloop) {
              console.log('[SINK] No sloop to move');
              return INVALID_MOVE;
            }
          }

          const hex = getHex(G.board, sinkData.hex);
          if (!hex) {
            console.log('[SINK] Invalid hex coordinate');
            return INVALID_MOVE;
          }

          // For validation, we need to consider the board state AFTER the optional sloop move
          // We'll do this by checking if sloop movement would result in player having pieces there
          let playerHasPiecesAtTarget = getPlayerShips(G.board, sinkData.hex, ctx.currentPlayer).length > 0;

          // If moving sloop to target hex, that will give us presence
          if (sinkData.moveSloopBefore && hexEquals(sinkData.moveSloopBefore.to, sinkData.hex)) {
            playerHasPiecesAtTarget = true;
          }

          if (!playerHasPiecesAtTarget) {
            console.log('[SINK] You have no pieces in target hex');
            return INVALID_MOVE;
          }

          // Check target has the ship to sink
          const targetShips = getPlayerShips(G.board, sinkData.hex, sinkData.targetPlayerId);
          const hasTargetShip = targetShips.some(s => s.type === sinkData.targetShipType);
          if (!hasTargetShip) {
            console.log('[SINK] Target ship not found in hex');
            return INVALID_MOVE;
          }

          // If sinking a Galleon, check influence requirement
          if (sinkData.targetShipType === ShipType.GALLEON) {
            const playerInfluence = getInfluence(G.board, sinkData.hex, ctx.currentPlayer);
            const targetInfluence = getInfluence(G.board, sinkData.hex, sinkData.targetPlayerId);
            if (playerInfluence < targetInfluence) {
              console.log('[SINK] Not enough influence to sink Galleon');
              return INVALID_MOVE;
            }
          }

          // Execute: spend doubloons for bribes
          if (actualBribesUsed > 0) {
            spendDoubloons(player, actualBribesUsed);
          }

          // Execute: move sloop (may be free depending on power)
          if (sinkData.moveSloopBefore) {
            const sloop: Ship = { type: ShipType.SLOOP, playerId: ctx.currentPlayer };
            removeShip(G.board, sinkData.moveSloopBefore.from, sloop);
            placeShip(G.board, sinkData.moveSloopBefore.to, sloop);
            console.log('[SINK] Moved sloop before sinking');
          }

          // Execute: sink the target ship
          const shipToSink: Ship = { type: sinkData.targetShipType, playerId: sinkData.targetPlayerId };
          removeShip(G.board, sinkData.hex, shipToSink);

          // Return ship to opponent's inventory
          const opponent = G.players.find(p => p.id === sinkData.targetPlayerId);
          if (opponent) {
            if (sinkData.targetShipType === ShipType.SLOOP) {
              returnShips(opponent, 'sloops', 1);
            } else {
              returnShips(opponent, 'galleons', 1);
            }

            // Trigger opponent's power passive (e.g., The Peaceful gains doubloon)
            const opponentPower = getPowerStrategy(opponent.piratePower);
            opponentPower.onShipSunk(opponent, sinkData.targetShipType, player);
          }

          // Calculate and award notoriety
          let notorietyGained = 0;
          if (opponent && opponent.notoriety >= player.notoriety) {
            notorietyGained = sinkData.targetShipType === ShipType.SLOOP ? 1 : 3;
            gainNotoriety(player, notorietyGained);
          }

          // Execute: sink additional ship if bribe 2 was used
          if (sinkData.additionalSink) {
            const additionalShip: Ship = {
              type: sinkData.additionalSink.shipType,
              playerId: sinkData.additionalSink.playerId
            };
            removeShip(G.board, sinkData.hex, additionalShip);

            const additionalOpponent = G.players.find(p => p.id === sinkData.additionalSink!.playerId);
            if (additionalOpponent) {
              if (sinkData.additionalSink.shipType === ShipType.SLOOP) {
                returnShips(additionalOpponent, 'sloops', 1);
              } else {
                returnShips(additionalOpponent, 'galleons', 1);
              }

              // Trigger opponent's power passive (e.g., The Peaceful gains doubloon)
              const additionalOpponentPower = getPowerStrategy(additionalOpponent.piratePower);
              additionalOpponentPower.onShipSunk(additionalOpponent, sinkData.additionalSink.shipType, player);
            }
            console.log('[SINK] Sank additional ship');
          }

          console.log(`[SINK] Sank ${sinkData.targetShipType}, gained ${notorietyGained} notoriety`);

          player.placedCaptains.splice(captainIndex, 1);
          events?.endTurn();
        },

        /**
         * Execute a CHART action
         * Draw 2 charts, keep 1. Gain the Wind Token.
         * Bribe 1: Draw 3 instead of 2
         * Bribe 2: Keep 2 instead of 1
         */
        chart: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, chartData: ChartMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          const captainIndex = player.placedCaptains.indexOf(ActionType.CHART);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Validate bribes
          if (chartData.bribesUsed > player.doubloons) {
            console.log('[CHART] Not enough doubloons for bribes');
            return INVALID_MOVE;
          }

          const drawCount = chartData.drawExtra ? 3 : 2;
          const keepCount = chartData.keepExtra ? 2 : 1;

          // Check if we have charts to draw (reshuffle discard if needed)
          if (G.chartDeck.drawPile.length < drawCount) {
            // Reshuffle discard pile into draw pile
            G.chartDeck.drawPile.push(...G.chartDeck.discardPile);
            G.chartDeck.discardPile = [];
            // Note: In a real implementation, we'd use ctx.random to shuffle
            // For now, simple shuffle
            for (let i = G.chartDeck.drawPile.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [G.chartDeck.drawPile[i], G.chartDeck.drawPile[j]] =
                [G.chartDeck.drawPile[j], G.chartDeck.drawPile[i]];
            }
          }

          // If selection has been made, finalize the action
          if (chartData.selectedChartIds && chartData.selectedChartIds.length > 0) {
            // Validate selection count
            if (chartData.selectedChartIds.length !== keepCount) {
              console.log(`[CHART] Must select exactly ${keepCount} chart(s) to keep`);
              return INVALID_MOVE;
            }

            // Execute: spend doubloons for bribes
            if (chartData.bribesUsed > 0) {
              spendDoubloons(player, chartData.bribesUsed);
            }

            // Draw charts from the deck
            const drawnCharts = G.chartDeck.drawPile.splice(0, drawCount);

            // Sort into keep and discard based on selection
            for (const chart of drawnCharts) {
              if (chartData.selectedChartIds.includes(chart.id)) {
                addChart(player, chart);
              } else {
                G.chartDeck.discardPile.push(chart);
              }
            }

            // Give the Wind token
            G.windTokenHolder = ctx.currentPlayer;

            console.log(`[CHART] Drew ${drawCount}, kept ${keepCount}. Player now holds Wind token`);

            player.placedCaptains.splice(captainIndex, 1);
            events?.endTurn();
          } else {
            // No selection made - this is a problem in a real game
            // For now, auto-select the first N charts
            console.log('[CHART] No chart selection provided - auto-selecting first charts');

            // Execute: spend doubloons for bribes
            if (chartData.bribesUsed > 0) {
              spendDoubloons(player, chartData.bribesUsed);
            }

            // Draw charts from the deck
            const actualDrawCount = Math.min(drawCount, G.chartDeck.drawPile.length);
            const drawnCharts = G.chartDeck.drawPile.splice(0, actualDrawCount);

            // Keep the first N charts, discard the rest
            const actualKeepCount = Math.min(keepCount, drawnCharts.length);
            for (let i = 0; i < drawnCharts.length; i++) {
              if (i < actualKeepCount) {
                addChart(player, drawnCharts[i]);
              } else {
                G.chartDeck.discardPile.push(drawnCharts[i]);
              }
            }

            // Give the Wind token
            G.windTokenHolder = ctx.currentPlayer;

            console.log(`[CHART] Drew ${actualDrawCount}, kept ${actualKeepCount}. Player now holds Wind token`);

            player.placedCaptains.splice(captainIndex, 1);
            events?.endTurn();
          }
        },

        /**
         * Skip turn if player has no captains or wants to pass
         */
        pass: ({ events }: { events: any }) => {
          events?.endTurn();
        }
      },

      endIf: ({ G }) => {
        // End when all players have used all captains
        return G.players.every(p => p.placedCaptains.length === 0);
      },

      next: 'pirate'
    },

    pirate: {
      onBegin: ({ G, ctx, events }) => {
        console.log('[PIRATE] Phase started');

        // Award notoriety for hex control (power can modify this)
        G.players.forEach(player => {
          const controlledHexes = getControlledHexes(G.board, player.id);
          const baseNotoriety = controlledHexes.length;

          // Apply power modification (e.g., The Relentless gets 0)
          const power = getPowerStrategy(player.piratePower);
          const notoriety = power.modifyHexControlNotoriety(baseNotoriety);

          if (notoriety > 0) {
            gainNotoriety(player, notoriety);
            console.log(`[PIRATE] ${player.name} gained ${notoriety} notoriety`);
          } else if (baseNotoriety > 0) {
            console.log(`[PIRATE] ${player.name} controls ${baseNotoriety} hex(es) but power prevents notoriety gain`);
          }
        });

        // Add doubloons to Island Raids
        G.chartDeck.islandRaids.forEach(raid => {
          if ('doubloonsOnChart' in raid) {
            (raid as any).doubloonsOnChart = ((raid as any).doubloonsOnChart || 0) + 1;
          }
        });

        // Check if 2nd Island Raid should be revealed
        const hasPlayerAt12 = G.players.some(p => p.notoriety >= 12);
        if (hasPlayerAt12 && G.chartDeck.islandRaids.length === 2) {
          // Both raids are already in the array; we'd just mark them as revealed
          // For now, this is handled by the fact that both are in the array
          console.log('[PIRATE] Player reached 12 notoriety - 2nd Island Raid revealed');
        }

        // Check for game end
        const winner = G.players.find(p => hasPlayerWon(p));
        if (winner) {
          events?.endGame({ winner: winner.id });
        }
      },

      turn: {
        order: {
          first: () => 0,
          next: ({ G, ctx }) => {
            if (G.windDirection === WindDirection.CLOCKWISE) {
              return (ctx.playOrderPos + 1) % ctx.numPlayers;
            } else {
              return (ctx.playOrderPos - 1 + ctx.numPlayers) % ctx.numPlayers;
            }
          }
        }
      },

      moves: {
        /**
         * Claim a chart during Pirate phase
         * Player can claim charts from their hand or public Island Raids
         */
        claimChart: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, claimData: ClaimChartData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          // Find the chart - either in player's hand or Island Raids
          let chart: AnyChart | undefined = player.charts.find(c => c.id === claimData.chartId);
          let isIslandRaid = false;

          if (!chart) {
            // Check if it's a public Island Raid
            chart = G.chartDeck.islandRaids.find(r => r.id === claimData.chartId);
            isIslandRaid = true;
          }

          if (!chart) {
            console.log('[CLAIM] Chart not found');
            return INVALID_MOVE;
          }

          // Validate based on chart type
          switch (chart.type) {
            case ChartType.TREASURE_MAP: {
              const treasureMap = chart as TreasureMapChart;
              const hex = getHex(G.board, treasureMap.targetHex);
              if (!hex) {
                console.log('[CLAIM] Target hex not found');
                return INVALID_MOVE;
              }

              // Must have a Galleon in the hex
              const playerShips = getPlayerShips(G.board, treasureMap.targetHex, ctx.currentPlayer);
              const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
              if (!hasGalleon) {
                console.log('[CLAIM] Need a Galleon at target hex');
                return INVALID_MOVE;
              }

              // Must control the hex
              const controller = getHexController(G.board, treasureMap.targetHex);
              if (controller !== ctx.currentPlayer) {
                console.log('[CLAIM] Must control the target hex');
                return INVALID_MOVE;
              }

              // Award reward: 1 doubloon per player
              const reward = G.players.length;
              gainDoubloons(player, reward);
              console.log(`[CLAIM] Claimed Treasure Map: +${reward} doubloons`);
              break;
            }

            case ChartType.ISLAND_RAID: {
              const islandRaid = chart as IslandRaidChart;
              const island = getIslandByName(G.board, islandRaid.targetIsland);
              if (!island) {
                console.log('[CLAIM] Target island not found');
                return INVALID_MOVE;
              }

              const hex = getHex(G.board, island.hexCoord);
              if (!hex) {
                console.log('[CLAIM] Island hex not found');
                return INVALID_MOVE;
              }

              // Must have a Galleon on the island
              const playerShips = getPlayerShips(G.board, island.hexCoord, ctx.currentPlayer);
              const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
              if (!hasGalleon) {
                console.log('[CLAIM] Need a Galleon on the island');
                return INVALID_MOVE;
              }

              // Must control the island
              const controller = getHexController(G.board, island.hexCoord);
              if (controller !== ctx.currentPlayer) {
                console.log('[CLAIM] Must control the island');
                return INVALID_MOVE;
              }

              // Must have at least 2 doubloons on chart
              if (islandRaid.doubloonsOnChart < 2) {
                console.log('[CLAIM] Island Raid needs at least 2 doubloons');
                return INVALID_MOVE;
              }

              // Award rewards: 4 notoriety + doubloons on chart
              gainNotoriety(player, islandRaid.notorietyReward);
              gainDoubloons(player, islandRaid.doubloonsOnChart);
              console.log(`[CLAIM] Claimed Island Raid: +${islandRaid.notorietyReward} notoriety, +${islandRaid.doubloonsOnChart} doubloons`);
              break;
            }

            case ChartType.SMUGGLER_ROUTE: {
              const smugglerRoute = chart as SmugglerRouteChart;
              const islandA = getIslandByName(G.board, smugglerRoute.islandA);
              const islandB = getIslandByName(G.board, smugglerRoute.islandB);

              if (!islandA || !islandB) {
                console.log('[CLAIM] One or both islands not found');
                return INVALID_MOVE;
              }

              // Find path between islands
              const path = findPathOnBoard(G.board, islandA.hexCoord, islandB.hexCoord);
              if (path.length === 0) {
                console.log('[CLAIM] No path exists between islands');
                return INVALID_MOVE;
              }

              // Check player has at least one ship in every hex on the path
              for (const hexCoord of path) {
                const playerShips = getPlayerShips(G.board, hexCoord, ctx.currentPlayer);
                if (playerShips.length === 0) {
                  console.log(`[CLAIM] Need a ship at (${hexCoord.q}, ${hexCoord.r})`);
                  return INVALID_MOVE;
                }
              }

              // Award reward: doubloons equal to path length
              const reward = path.length;
              gainDoubloons(player, reward);
              console.log(`[CLAIM] Claimed Smuggler Route: +${reward} doubloons`);
              break;
            }

            default:
              console.log('[CLAIM] Unknown chart type');
              return INVALID_MOVE;
          }

          // Remove chart from player's hand (if not Island Raid)
          if (!isIslandRaid) {
            const chartIndex = player.charts.findIndex(c => c.id === claimData.chartId);
            if (chartIndex !== -1) {
              player.charts.splice(chartIndex, 1);
            }
            // Add to discard pile
            G.chartDeck.discardPile.push(chart);
          } else {
            // Remove from active Island Raids
            const raidIndex = G.chartDeck.islandRaids.findIndex(r => r.id === claimData.chartId);
            if (raidIndex !== -1) {
              G.chartDeck.islandRaids.splice(raidIndex, 1);
            }
          }

          // Check for game end after claiming
          if (hasPlayerWon(player)) {
            events?.endGame({ winner: player.id });
          }

          // Don't end turn - player may claim more charts
        },

        /**
         * End turn during Pirate phase (done claiming charts)
         */
        doneClaiming: ({ events }: { events: any }) => {
          events?.endTurn();
        }
      },

      // End when all players have had a turn
      endIf: ({ ctx }) => {
        // We use automatic turn tracking - phase ends after each player gets a turn
        // This is handled by boardgame.io's turn system
        return false;  // Let doneClaiming handle turn advancement
      },

      // After all players have claimed, return to place phase
      onEnd: ({ G }) => {
        console.log('[PIRATE] Phase ending, returning to PLACE phase');
      },

      next: 'place'
    }
  },

  /**
   * Win condition
   */
  endIf: ({ G }) => {
    const winner = G.players.find(p => hasPlayerWon(p));
    if (winner) {
      return { winner: winner.id };
    }
  },

  /**
   * Minimum and maximum players
   */
  minPlayers: 2,
  maxPlayers: 4
};
