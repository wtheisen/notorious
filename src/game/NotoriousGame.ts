import { Game, Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { NotoriousState, PlayerState, BoardState, hexToKey, Ship, WindTokenState } from './types/GameState';
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
  setPortLocation,
  getFinalScore
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
  getAllHexes,
  boardDistance
} from './logic/BoardLogic';
import { IslandPlacer } from '../core/IslandPlacer';
import { ChartFactory, AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../core/Chart';
import { ChartType } from '../types/GameTypes';
import { BOARD_HEXES } from '../config/HexConstants';
// hexDistance import removed — use boardDistance from BoardLogic for wrap-aware distances

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
  // Bribe type 1 (repeatable): Move sloops before sinking
  sloopMovesBefore: { from: HexCoord; to: HexCoord }[];
  // Bribe type 2 (repeatable): Sink additional ships in same hex
  additionalSinks: { shipType: ShipType; playerId: string }[];
}

/** CHART action move data */
interface ChartMoveData {
  // Each bribe: either draw 1 more OR keep 1 more (repeatable)
  bribeChoices: ('draw' | 'keep')[];
  selectedChartIds?: string[];  // Charts to keep (if selection phase)
}

/** CLAIM CHART move data (used during Pirate phase) */
interface ClaimChartData {
  chartId: string;
}

/** SET WIND TOKEN move data (used during Pirate phase by wind token holder) */
interface SetWindTokenData {
  flip: boolean;            // Reverse the placeDirection
  newPosition: number;      // 0-3: which gap to place the token
}

// ============================================
// Wind Token Helpers
// ============================================

/** Get the opposite wind direction */
function oppositeDirection(dir: WindDirection): WindDirection {
  return dir === WindDirection.CLOCKWISE ? WindDirection.COUNTERCLOCKWISE : WindDirection.CLOCKWISE;
}

/** Get the next player index in a given direction */
function getNextInDirection(pos: number, direction: WindDirection, numPlayers: number): number {
  if (direction === WindDirection.CLOCKWISE) return (pos + 1) % numPlayers;
  return (pos - 1 + numPlayers) % numPlayers;
}

/**
 * Derive the first player for a phase from the wind token state.
 * For PLACE: the player the PLACE arrow points at.
 * - CLOCKWISE arrow at position P → first placer is player (P+1) % n
 * - COUNTERCLOCKWISE arrow at position P → first placer is player P
 */
function getFirstPlayerForPlace(windToken: WindTokenState, numPlayers: number): number {
  if (windToken.placeDirection === WindDirection.CLOCKWISE) {
    return (windToken.position + 1) % numPlayers;
  }
  return windToken.position;
}

/**
 * Derive the first player for PLAY phase (opposite of PLACE).
 * The last placer goes first in PLAY, which is the first player in opposite direction.
 */
function getFirstPlayerForPlay(windToken: WindTokenState, numPlayers: number): number {
  const playDirection = oppositeDirection(windToken.placeDirection);
  if (playDirection === WindDirection.CLOCKWISE) {
    return (windToken.position + 1) % numPlayers;
  }
  return windToken.position;
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
      const isAIPlayer = index > 0; // Player 2+ are AI controlled
      return {
        id,
        name: isAIPlayer ? `AI Player ${parseInt(id) + 1}` : `Player ${parseInt(id) + 1}`,
        color: colors[index] || PlayerColor.BLUE,
        isAI: isAIPlayer,
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

    // Place islands — pass deterministic shuffle so placement is replayable
    const islandPlacer = new IslandPlacer((arr) => random!.Shuffle([...arr]));
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


    // Initialize chart deck
    const allSmugglerRoutes = ChartFactory.createAllSmugglerRoutes();
    const shuffledIslands = random!.Shuffle([...islands]);
    const allIslandRaids = [
      ChartFactory.createIslandRaid(shuffledIslands[0].name as any, GAME_CONSTANTS.ISLAND_RAID_THRESHOLDS[0]),
      ChartFactory.createIslandRaid(shuffledIslands[1].name as any, GAME_CONSTANTS.ISLAND_RAID_THRESHOLDS[1])
    ];

    // Create shuffled draw pile from treasure maps and smuggler routes
    const drawPile = random!.Shuffle([
      ...remainingTreasureMaps,
      ...allSmugglerRoutes
    ]);

    const chartDeck = {
      drawPile,
      discardPile: [] as AnyChart[],
      islandRaids: [allIslandRaids[0]],   // 1st raid visible from start
      hiddenIslandRaids: allIslandRaids.slice(1),  // 2nd raid revealed at threshold
    };

    return {
      players,
      board,
      chartDeck,
      windToken: {
        position: 0,
        placeDirection: WindDirection.CLOCKWISE,
        holder: null,
      },
      setupComplete: new Array(ctx.numPlayers).fill(false),
      setupPlacements: new Array(ctx.numPlayers).fill(0),
      setupRound: 0,
      gameEndTriggered: false,
      piratePhaseTurnsComplete: 0
    };
  },

  /**
   * Game phases
   */
  phases: {
    // SETUP PHASE: Snake draft - each player places twice
    // Round 1 (forward): Player 0→1→2→3, each places Port+2Sloops OR Galleon+2Sloops
    // Round 2 (reverse): Player 3→2→1→0, each places the other option
    setup: {
      start: true,

      onBegin: ({ G }) => {
      },

      turn: {
        order: {
          first: () => 0,
          next: ({ G, ctx }) => {
            const n = ctx.numPlayers;
            // Count total placements to determine round
            const totalPlacements = G.setupPlacements.reduce((a, b) => a + b, 0);
            if (totalPlacements < n) {
              // Round 1: forward
              const next = ctx.playOrderPos + 1;
              if (next >= n) return n - 1; // last player goes again for round 2
              return next;
            } else {
              // Round 2: reverse (snake)
              const next = ctx.playOrderPos - 1;
              if (next < 0) return undefined;
              return next;
            }
          }
        }
      },

      moves: {
        /**
         * Place port + 2 sloops on a hex (first placement for this player)
         */
        placePortAndShips: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, hex: HexCoord) => {
          const playerIndex = parseInt(ctx.currentPlayer);
          const player = G.players[playerIndex];

          // Must not have placed port yet
          if (player.portLocation) {
            return INVALID_MOVE;
          }

          const hexState = getHex(G.board, hex);
          if (!hexState) return INVALID_MOVE;

          // Place port
          setPortLocation(player, hex);
          placeShip(G.board, hex, { type: ShipType.PORT, playerId: ctx.currentPlayer });

          // Place 2 sloops
          placeShip(G.board, hex, { type: ShipType.SLOOP, playerId: ctx.currentPlayer });
          placeShip(G.board, hex, { type: ShipType.SLOOP, playerId: ctx.currentPlayer });
          spendShips(player, 'sloops', 2);

          G.setupPlacements[playerIndex]++;
          if (G.setupPlacements[playerIndex] >= 2) G.setupComplete[playerIndex] = true;

          events?.endTurn();
        },

        /**
         * Place galleon + 2 sloops on a hex (second placement for this player)
         */
        placeGalleonAndShips: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, hex: HexCoord) => {
          const playerIndex = parseInt(ctx.currentPlayer);
          const player = G.players[playerIndex];

          // Must have already placed port
          if (!player.portLocation) {
            return INVALID_MOVE;
          }

          // Must not have completed setup yet
          if (G.setupComplete[playerIndex]) {
            return INVALID_MOVE;
          }

          const hexState = getHex(G.board, hex);
          if (!hexState) return INVALID_MOVE;


          // Place galleon + 2 sloops
          placeShip(G.board, hex, { type: ShipType.GALLEON, playerId: ctx.currentPlayer });
          spendShips(player, 'galleons', 1);
          placeShip(G.board, hex, { type: ShipType.SLOOP, playerId: ctx.currentPlayer });
          placeShip(G.board, hex, { type: ShipType.SLOOP, playerId: ctx.currentPlayer });
          spendShips(player, 'sloops', 2);

          G.setupPlacements[playerIndex]++;
          G.setupComplete[playerIndex] = true;

          events?.endTurn();
        },
      },

      endIf: ({ G }) => {
        return G.setupComplete.every(complete => complete);
      },

      next: 'place'
    },

    // PLACE PHASE: Players place captains on action slots (round-robin, one at a time)
    place: {
      onBegin: ({ G }) => {
        // Reset all players' captain placements for new round
        G.players.forEach(p => p.placedCaptains = []);
      },

      turn: {
        order: {
          first: ({ G, ctx }) => getFirstPlayerForPlace(G.windToken, ctx.numPlayers),
          next: ({ G, ctx }) => {
            // Round-robin in PLACE direction: find next player who still has captains
            const numPlayers = ctx.numPlayers;
            let nextPos = ctx.playOrderPos;

            for (let i = 0; i < numPlayers; i++) {
              nextPos = getNextInDirection(nextPos, G.windToken.placeDirection, numPlayers);

              const nextPlayer = G.players[nextPos];
              if (nextPlayer.placedCaptains.length < nextPlayer.captainCount) {
                return nextPos;
              }
            }

            // All players done
            return undefined;
          }
        }
      },

      moves: {
        /**
         * Place a captain on an action slot
         * Each player places ONE captain, then turn advances to next player
         */
        placeCaptain: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, actionType: ActionType) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          if (!placeCaptain(player, actionType)) {
            return INVALID_MOVE;
          }


          // End turn after placing ONE captain - advances to next player
          events?.endTurn();
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
      },

      turn: {
        order: {
          first: ({ G, ctx }) => {
            // PLAY uses opposite direction of PLACE
            const playDirection = oppositeDirection(G.windToken.placeDirection);
            const startPlayer = getFirstPlayerForPlay(G.windToken, ctx.numPlayers);
            // Find first player with captains starting from the play-order first player
            let pos = startPlayer;
            for (let i = 0; i < ctx.numPlayers; i++) {
              if (G.players[pos].placedCaptains.length > 0) {
                return pos;
              }
              pos = getNextInDirection(pos, playDirection, ctx.numPlayers);
            }
            return 0;
          },
          next: ({ G, ctx }) => {
            // PLAY uses opposite direction of PLACE
            const playDirection = oppositeDirection(G.windToken.placeDirection);
            const numPlayers = ctx.numPlayers;
            let nextPos = ctx.playOrderPos;

            for (let i = 0; i < numPlayers; i++) {
              nextPos = getNextInDirection(nextPos, playDirection, numPlayers);

              const nextPlayer = G.players[nextPos];
              if (nextPlayer.placedCaptains.length > 0) {
                return nextPos;
              }
            }

            // No players with captains left
            return undefined;
          }
        }
      },

      moves: {
        /**
         * Execute a SAIL action
         * Base: Move 1 ship up to 2 hexes OR 2 ships 1 hex each (= 2 movement points)
         * Bribe (repeatable): Move a Ship one Hex (= 1 movement point each)
         * The Sailor: Can move up to 3 hexes instead of 2
         * The Islander: Can ignore impassable island edges
         */
        sail: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, moveData: SailMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          // Check player has SAIL captain
          const captainIndex = player.placedCaptains.indexOf(ActionType.SAIL);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Get player's power strategy for sail modifications
          const power = getPowerStrategy(player.piratePower);
          const maxDistance = power.getSailMaxDistance();

          // Calculate total movement points used
          // Each hex of movement costs 1 point
          // Use boardDistance (BFS) instead of hexDistance so wrapping is handled
          let totalMovementPoints = 0;
          for (const move of moveData.moves) {
            const distance = boardDistance(move.from, move.to, maxDistance);
            totalMovementPoints += distance;
          }

          // Base action gives 2 movement points, each bribe gives 1 more
          const basePoints = 2;
          const bribesNeeded = Math.max(0, totalMovementPoints - basePoints);

          // Validate bribes match what's needed
          if (moveData.bribesUsed < bribesNeeded) {
            return INVALID_MOVE;
          }

          // Validate player has enough doubloons
          if (moveData.bribesUsed > player.doubloons) {
            return INVALID_MOVE;
          }

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
              return INVALID_MOVE;
            }

            // Check player has a ship of this type at the source
            const playerShips = getPlayerShips(G.board, move.from, ctx.currentPlayer);
            const hasShip = playerShips.some(s => s.type === move.shipType);
            if (!hasShip) {
              return INVALID_MOVE;
            }

            // Check path is valid (boardDistance handles wrapping)
            const distance = boardDistance(move.from, move.to, maxDistance);
            if (distance === 0) {
              return INVALID_MOVE;
            } else if (distance > maxDistance || distance === Infinity) {
              return INVALID_MOVE;
            } else if (distance === 1) {
              if (!canSailForPlayer(move.from, move.to)) {
                return INVALID_MOVE;
              }
            } else {
              // For 2+ hex moves, find a valid path
              const neighbors = getNeighbors(G.board, move.from);
              const validPath = neighbors.some(neighbor => {
                if (!canSailForPlayer(move.from, neighbor.coord)) return false;
                const remainingDistance = boardDistance(neighbor.coord, move.to, maxDistance - 1);
                if (remainingDistance === 0) return true;
                if (remainingDistance === 1) return canSailForPlayer(neighbor.coord, move.to);
                if (remainingDistance === 2 && distance === 3) {
                  // For 3-hex moves, need another intermediate
                  const secondNeighbors = getNeighbors(G.board, neighbor.coord);
                  return secondNeighbors.some(n2 => {
                    return canSailForPlayer(neighbor.coord, n2.coord) &&
                      boardDistance(n2.coord, move.to, 1) === 1 &&
                      canSailForPlayer(n2.coord, move.to);
                  });
                }
                return false;
              });
              if (!validPath) {
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


          // Remove captain
          player.placedCaptains.splice(captainIndex, 1);
          events?.endTurn();
        },

        /**
         * Execute a BUILD action
         * Base: Place 2 Sloops OR 1 Galleon in a hex with your pieces (or your port)
         * Bribe (repeatable): Place an additional Sloop
         */
        build: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, buildData: BuildMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          // Check player has BUILD captain
          const captainIndex = player.placedCaptains.indexOf(ActionType.BUILD);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Count ships to place
          const sloopsToPlace = buildData.placements.filter(s => s === ShipType.SLOOP).length;
          const galleonsToPlace = buildData.placements.filter(s => s === ShipType.GALLEON).length;

          // Can only place 1 Galleon (bribes only add Sloops)
          if (galleonsToPlace > 1) {
            return INVALID_MOVE;
          }

          // Calculate bribes needed:
          // - If placing a Galleon: base is 1 Galleon, bribes = number of Sloops
          // - If placing only Sloops: base is 2 Sloops, bribes = max(0, sloops - 2)
          let bribesNeeded: number;
          if (galleonsToPlace === 1) {
            bribesNeeded = sloopsToPlace;  // Each additional sloop costs 1 bribe
          } else {
            bribesNeeded = Math.max(0, sloopsToPlace - 2);  // First 2 sloops are base
          }

          // Validate bribes match what's needed
          if (buildData.bribesUsed < bribesNeeded) {
            return INVALID_MOVE;
          }

          // Validate player has enough doubloons
          if (buildData.bribesUsed > player.doubloons) {
            return INVALID_MOVE;
          }

          const hex = getHex(G.board, buildData.hex);
          if (!hex) {
            return INVALID_MOVE;
          }

          // Check if hex has player's pieces or is their port
          const playerShips = getPlayerShips(G.board, buildData.hex, ctx.currentPlayer);
          const hasPlayerPieces = playerShips.length > 0;
          const isPortHex = player.portLocation &&
            hexEquals(player.portLocation, buildData.hex);

          if (!hasPlayerPieces && !isPortHex) {
            return INVALID_MOVE;
          }

          // Check for enemy pieces (allowed in port hex)
          const allShips = hex.ships;
          const hasEnemyPieces = allShips.some(s => s.playerId !== ctx.currentPlayer);
          if (hasEnemyPieces && !isPortHex) {
            return INVALID_MOVE;
          }

          // Validate ship inventory
          const sloopsNeeded = buildData.placements.filter(s => s === ShipType.SLOOP).length;
          const galleonsNeeded = buildData.placements.filter(s => s === ShipType.GALLEON).length;

          if (!hasShips(player, 'sloops', sloopsNeeded)) {
            return INVALID_MOVE;
          }
          if (!hasShips(player, 'galleons', galleonsNeeded)) {
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
            return INVALID_MOVE;
          }

          // Check player has at least one piece in this hex
          const playerShips = getPlayerShips(G.board, stealData.hex, ctx.currentPlayer);
          if (playerShips.length === 0) {
            return INVALID_MOVE;
          }

          // Cannot steal from yourself
          if (stealData.targetPlayerId === ctx.currentPlayer) {
            return INVALID_MOVE;
          }

          // Check target has a sloop in this hex
          const targetShips = getPlayerShips(G.board, stealData.hex, stealData.targetPlayerId);
          const hasSloop = targetShips.some(s => s.type === ShipType.SLOOP);
          if (!hasSloop) {
            return INVALID_MOVE;
          }

          // Check player has a sloop to place (if they want to replace)
          if (stealData.replaceWithSloop && !hasShips(player, 'sloops', 1)) {
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


          player.placedCaptains.splice(captainIndex, 1);
          events?.endTurn();
        },

        /**
         * Execute a SINK action
         * Base: Remove one opponent's ship in a hex with your pieces
         * Gain notoriety if opponent is at least as notorious as you
         * Bribe type 1 (repeatable): Move a sloop 1 hex before sinking
         * Bribe type 2 (repeatable): Sink an additional ship in the same hex
         * The Peaceful: Cannot use this action
         * The Relentless: First sloop move is free
         */
        sink: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, sinkData: SinkMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];
          const power = getPowerStrategy(player.piratePower);

          // Check if power allows SINK action (e.g., The Peaceful cannot)
          if (!power.canUseSink()) {
            return INVALID_MOVE;
          }

          const captainIndex = player.placedCaptains.indexOf(ActionType.SINK);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Calculate bribes needed
          // Bribe type 1: each sloop move costs 1 (Relentless gets first one free)
          // Bribe type 2: each additional sink costs 1
          const sloopMoves = sinkData.sloopMovesBefore?.length || 0;
          const additionalSinks = sinkData.additionalSinks?.length || 0;

          // Apply power's cost modification for sloop moves (Relentless gets first free)
          const sloopMoveBribes = power.modifySinkCost(sloopMoves, { movingSloop: sloopMoves > 0 });
          const totalBribesNeeded = sloopMoveBribes + additionalSinks;

          // Validate bribes
          if (totalBribesNeeded > player.doubloons) {
            return INVALID_MOVE;
          }

          // Validate all sloop movements
          for (const sloopMove of sinkData.sloopMovesBefore || []) {
            const fromHex = getHex(G.board, sloopMove.from);
            const toHex = getHex(G.board, sloopMove.to);

            if (!fromHex || !toHex) {
              return INVALID_MOVE;
            }

            if (!canSailBetween(G.board, sloopMove.from, sloopMove.to)) {
              return INVALID_MOVE;
            }

            // Note: We check sloop presence during execution since earlier moves affect later ones
          }

          const hex = getHex(G.board, sinkData.hex);
          if (!hex) {
            return INVALID_MOVE;
          }

          // Check player will have pieces at target after sloop moves
          let playerHasPiecesAtTarget = getPlayerShips(G.board, sinkData.hex, ctx.currentPlayer).length > 0;

          // If any sloop moves to target hex, that will give us presence
          for (const sloopMove of sinkData.sloopMovesBefore || []) {
            if (hexEquals(sloopMove.to, sinkData.hex)) {
              playerHasPiecesAtTarget = true;
              break;
            }
          }

          if (!playerHasPiecesAtTarget) {
            return INVALID_MOVE;
          }

          // Build list of all ships to sink (base + additional)
          const allShipsToSink = [
            { shipType: sinkData.targetShipType, playerId: sinkData.targetPlayerId },
            ...(sinkData.additionalSinks || [])
          ];

          // Cannot sink your own ships
          if (allShipsToSink.some(t => t.playerId === ctx.currentPlayer)) {
            return INVALID_MOVE;
          }

          // Validate all target ships exist
          for (const target of allShipsToSink) {
            const targetShips = getPlayerShips(G.board, sinkData.hex, target.playerId);
            const shipCount = targetShips.filter(s => s.type === target.shipType).length;
            const neededCount = allShipsToSink.filter(
              t => t.playerId === target.playerId && t.shipType === target.shipType
            ).length;

            if (shipCount < neededCount) {
              return INVALID_MOVE;
            }

            // If sinking a Galleon, must have strict influence majority
            if (target.shipType === ShipType.GALLEON) {
              const playerInfluence = getInfluence(G.board, sinkData.hex, ctx.currentPlayer);
              const targetInfluence = getInfluence(G.board, sinkData.hex, target.playerId);
              if (playerInfluence <= targetInfluence) {
                return INVALID_MOVE;
              }
            }
          }

          // Execute: spend doubloons for bribes
          if (totalBribesNeeded > 0) {
            spendDoubloons(player, totalBribesNeeded);
          }

          // Execute: move all sloops
          for (const sloopMove of sinkData.sloopMovesBefore || []) {
            const sloop: Ship = { type: ShipType.SLOOP, playerId: ctx.currentPlayer };
            removeShip(G.board, sloopMove.from, sloop);
            placeShip(G.board, sloopMove.to, sloop);
          }

          // Execute: sink all target ships
          let totalNotorietyGained = 0;
          for (const target of allShipsToSink) {
            const shipToSink: Ship = { type: target.shipType, playerId: target.playerId };
            removeShip(G.board, sinkData.hex, shipToSink);

            // Return ship to opponent's inventory
            const opponent = G.players.find(p => p.id === target.playerId);
            if (opponent) {
              if (target.shipType === ShipType.SLOOP) {
                returnShips(opponent, 'sloops', 1);
              } else {
                returnShips(opponent, 'galleons', 1);
              }

              // Trigger opponent's power passive (e.g., The Peaceful gains doubloon)
              const opponentPower = getPowerStrategy(opponent.piratePower);
              opponentPower.onShipSunk(opponent, target.shipType, player);

              // Calculate and award notoriety
              if (opponent.notoriety >= player.notoriety) {
                const notoriety = target.shipType === ShipType.SLOOP ? 1 : 3;
                gainNotoriety(player, notoriety);
                totalNotorietyGained += notoriety;
              }
            }
          }


          player.placedCaptains.splice(captainIndex, 1);
          events?.endTurn();
        },

        /**
         * Execute a CHART action
         * Base: Draw 2 charts, keep 1. Gain the Wind Token.
         * Bribe (repeatable): Either draw 1 more chart OR keep 1 more chart
         */
        chart: ({ G, ctx, events, random }: { G: NotoriousState; ctx: Ctx; events: any; random: any }, chartData: ChartMoveData) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          const captainIndex = player.placedCaptains.indexOf(ActionType.CHART);
          if (captainIndex === -1) {
            return INVALID_MOVE;
          }

          // Calculate draw and keep counts based on bribes
          // Base: draw 2, keep 1
          // Each 'draw' bribe: +1 to draw
          // Each 'keep' bribe: +1 to keep
          const bribes = chartData.bribeChoices || [];
          const bribesUsed = bribes.length;
          const extraDraw = bribes.filter(b => b === 'draw').length;
          const extraKeep = bribes.filter(b => b === 'keep').length;

          const drawCount = 2 + extraDraw;
          const keepCount = 1 + extraKeep;

          // Validate: can't keep more than you draw
          if (keepCount > drawCount) {
            return INVALID_MOVE;
          }

          // Validate bribes
          if (bribesUsed > player.doubloons) {
            return INVALID_MOVE;
          }

          // Check if we have charts to draw (reshuffle discard if needed)
          if (G.chartDeck.drawPile.length < drawCount) {
            // Reshuffle discard pile into draw pile using boardgame.io's
            // deterministic random so replays and multiplayer stay in sync
            G.chartDeck.drawPile = random.Shuffle([
              ...G.chartDeck.drawPile,
              ...G.chartDeck.discardPile,
            ]);
            G.chartDeck.discardPile = [];
          }

          // If selection has been made, finalize the action
          if (chartData.selectedChartIds && chartData.selectedChartIds.length > 0) {
            // Validate selection count (allow keeping fewer if deck ran out)
            const availableCards = G.chartDeck.drawPile.length + G.chartDeck.discardPile.length;
            const maxKeep = Math.min(keepCount, Math.min(drawCount, availableCards));
            if (chartData.selectedChartIds.length > maxKeep) {
              return INVALID_MOVE;
            }

            // Execute: spend doubloons for bribes
            if (bribesUsed > 0) {
              spendDoubloons(player, bribesUsed);
            }

            // Draw charts from the deck (cap to available cards after reshuffle)
            const actualDraw = Math.min(drawCount, G.chartDeck.drawPile.length);
            const drawnCharts = G.chartDeck.drawPile.splice(0, actualDraw);

            // Sort into keep and discard based on selection
            for (const chart of drawnCharts) {
              if (chartData.selectedChartIds.includes(chart.id)) {
                addChart(player, chart);
              } else {
                G.chartDeck.discardPile.push(chart);
              }
            }

            // Give the Wind token
            G.windToken.holder = ctx.currentPlayer;


            player.placedCaptains.splice(captainIndex, 1);
            events?.endTurn();
          } else {
            // No selection made - this is a problem in a real game
            // For now, auto-select the first N charts

            // Execute: spend doubloons for bribes
            if (bribesUsed > 0) {
              spendDoubloons(player, bribesUsed);
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
            G.windToken.holder = ctx.currentPlayer;


            player.placedCaptains.splice(captainIndex, 1);
            events?.endTurn();
          }
        },

        /**
         * Skip/forfeit the current action when it can't be executed
         * Consumes the captain but does nothing - it's a missed action
         */
        skipAction: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          if (player.placedCaptains.length === 0) {
            return INVALID_MOVE;
          }

          // Remove the captain (forfeit the action)
          const skippedAction = player.placedCaptains.pop();

          events?.endTurn();
        },

        /**
         * Pass turn (only valid if player has no captains left)
         */
        pass: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }) => {
          const player = G.players[parseInt(ctx.currentPlayer)];

          // Can only pass if no captains left
          if (player.placedCaptains.length > 0) {
            return INVALID_MOVE;
          }

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

        // Reset pirate phase turn tracker
        G.piratePhaseTurnsComplete = 0;

        // Award notoriety for hex control (power can modify this)
        G.players.forEach(player => {
          const controlledHexes = getControlledHexes(G.board, player.id);
          const baseNotoriety = controlledHexes.length;

          // Apply power modification (e.g., The Relentless gets 0)
          const power = getPowerStrategy(player.piratePower);
          const notoriety = power.modifyHexControlNotoriety(baseNotoriety);


          if (notoriety > 0) {
            gainNotoriety(player, notoriety);
          }
        });

        // Add doubloons to Island Raids
        G.chartDeck.islandRaids.forEach(raid => {
          if ('doubloonsOnChart' in raid) {
            (raid as any).doubloonsOnChart = ((raid as any).doubloonsOnChart || 0) + 1;
          }
        });

        // Reveal hidden island raids at the first threshold
        const maxNotoriety = Math.max(...G.players.map(p => p.notoriety));
        if (maxNotoriety >= GAME_CONSTANTS.ISLAND_RAID_THRESHOLDS[0] && G.chartDeck.hiddenIslandRaids.length > 0) {
          const raid = G.chartDeck.hiddenIslandRaids.shift()!;
          G.chartDeck.islandRaids.push(raid);
        }

        // Check if game end is triggered (someone reached 24)
        // Don't end immediately - finish the round first
        if (!G.gameEndTriggered && G.players.some(p => hasPlayerWon(p))) {
          G.gameEndTriggered = true;
        }
      },

      turn: {
        order: {
          first: ({ G, ctx }) => getFirstPlayerForPlace(G.windToken, ctx.numPlayers),
          next: ({ G, ctx }) => {
            return getNextInDirection(ctx.playOrderPos, G.windToken.placeDirection, ctx.numPlayers);
          }
        }
      },

      moves: {
        /**
         * Set wind token position and/or flip direction.
         * Only callable by the wind token holder during PIRATE phase.
         */
        setWindToken: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }, data: SetWindTokenData) => {
          if (G.windToken.holder !== ctx.currentPlayer) {
            return INVALID_MOVE;
          }

          // Validate position
          if (data.newPosition < 0 || data.newPosition >= ctx.numPlayers) {
            return INVALID_MOVE;
          }

          if (data.flip) {
            G.windToken.placeDirection = oppositeDirection(G.windToken.placeDirection);
          }
          G.windToken.position = data.newPosition;

        },

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
            return INVALID_MOVE;
          }

          // Validate based on chart type
          switch (chart.type) {
            case ChartType.TREASURE_MAP: {
              const treasureMap = chart as TreasureMapChart;
              const hex = getHex(G.board, treasureMap.targetHex);
              if (!hex) {
                return INVALID_MOVE;
              }

              // Must have a Galleon in the hex
              const playerShips = getPlayerShips(G.board, treasureMap.targetHex, ctx.currentPlayer);
              const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
              if (!hasGalleon) {
                return INVALID_MOVE;
              }

              // Must control the hex
              const controller = getHexController(G.board, treasureMap.targetHex);
              if (controller !== ctx.currentPlayer) {
                return INVALID_MOVE;
              }

              // Award reward: 1 doubloon per player
              const reward = G.players.length;
              gainDoubloons(player, reward);
              break;
            }

            case ChartType.ISLAND_RAID: {
              const islandRaid = chart as IslandRaidChart;
              const island = getIslandByName(G.board, islandRaid.targetIsland);
              if (!island) {
                return INVALID_MOVE;
              }

              const hex = getHex(G.board, island.hexCoord);
              if (!hex) {
                return INVALID_MOVE;
              }

              // Must have a Galleon on the island
              const playerShips = getPlayerShips(G.board, island.hexCoord, ctx.currentPlayer);
              const hasGalleon = playerShips.some(s => s.type === ShipType.GALLEON);
              if (!hasGalleon) {
                return INVALID_MOVE;
              }

              // Must control the island
              const controller = getHexController(G.board, island.hexCoord);
              if (controller !== ctx.currentPlayer) {
                return INVALID_MOVE;
              }

              // Island Raids are only claimable once the notoriety threshold is reached
              const raidThreshold = islandRaid.claimThreshold;
              const currentMaxNotoriety = Math.max(...G.players.map(p => p.notoriety));
              if (currentMaxNotoriety < raidThreshold) {
                return INVALID_MOVE;
              }

              // Award rewards: 4 notoriety + doubloons on chart
              gainNotoriety(player, islandRaid.notorietyReward);
              gainDoubloons(player, islandRaid.doubloonsOnChart);
              break;
            }

            case ChartType.SMUGGLER_ROUTE: {
              const smugglerRoute = chart as SmugglerRouteChart;
              const islandA = getIslandByName(G.board, smugglerRoute.islandA);
              const islandB = getIslandByName(G.board, smugglerRoute.islandB);

              if (!islandA || !islandB) {
                return INVALID_MOVE;
              }

              // Find path between islands
              const path = findPathOnBoard(G.board, islandA.hexCoord, islandB.hexCoord);
              if (path.length === 0) {
                return INVALID_MOVE;
              }

              // Check player has at least one ship in every hex on the path
              for (const hexCoord of path) {
                const playerShips = getPlayerShips(G.board, hexCoord, ctx.currentPlayer);
                if (playerShips.length === 0) {
                  return INVALID_MOVE;
                }
              }

              // Award reward: doubloons equal to path length
              const reward = path.length;
              gainDoubloons(player, reward);
              break;
            }

            default:
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

          // Check if game end is triggered (someone reached 24)
          // Game will end after the round completes
          if (!G.gameEndTriggered && hasPlayerWon(player)) {
            G.gameEndTriggered = true;
          }

          // Don't end turn - player may claim more charts
        },

        /**
         * End turn during Pirate phase (done claiming charts)
         */
        doneClaiming: ({ G, ctx, events }: { G: NotoriousState; ctx: Ctx; events: any }) => {
          G.piratePhaseTurnsComplete++;
          events?.endTurn();
        }
      },

      // End when all players have had a turn
      endIf: ({ G, ctx }) => {
        return G.piratePhaseTurnsComplete >= ctx.numPlayers;
      },

      // After all players have claimed, advance wind token and return to PLACE phase
      onEnd: ({ G, ctx }) => {
        // If no one claimed the wind token this round, advance position in place direction
        if (!G.windToken.holder) {
          G.windToken.position = getNextInDirection(
            G.windToken.position, G.windToken.placeDirection, ctx.numPlayers
          );
        }
        // Reset holder for next round
        G.windToken.holder = null;
      },

      next: 'place'
    }
  },

  /**
   * Win condition - triggers at end of round when gameEndTriggered is true
   * Final score = Notoriety + Doubloons
   * Tiebreaker: Bounty → Notoriety → Islands controlled → Galleons on board
   */
  endIf: ({ G }) => {
    // Only end game after round completes (pirate phase sets this flag)
    if (!G.gameEndTriggered) {
      return;
    }

    // Calculate final scores and determine winner
    const playerScores = G.players.map(player => {
      const finalScore = getFinalScore(player);
      const power = getPowerStrategy(player.piratePower);
      const bounty = power.bounty;

      // Count islands controlled by this player
      const controlledHexes = getControlledHexes(G.board, player.id);
      const islandsControlled = controlledHexes.filter(hex => hex.island !== null).length;

      // Count galleons on board
      let galleonsOnBoard = 0;
      Object.values(G.board.hexes).forEach(hex => {
        hex.ships.forEach(ship => {
          if (ship.playerId === player.id && ship.type === ShipType.GALLEON) {
            galleonsOnBoard++;
          }
        });
      });

      return {
        playerId: player.id,
        playerName: player.name,
        finalScore,
        bounty,
        notoriety: player.notoriety,
        islandsControlled,
        galleonsOnBoard
      };
    });

    // Sort by tiebreaker rules: Score → Bounty → Notoriety → Islands → Galleons
    playerScores.sort((a, b) => {
      // Higher score wins
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      // Higher bounty wins (tiebreaker 1)
      if (b.bounty !== a.bounty) return b.bounty - a.bounty;
      // Higher notoriety wins (tiebreaker 2)
      if (b.notoriety !== a.notoriety) return b.notoriety - a.notoriety;
      // More islands controlled wins (tiebreaker 3)
      if (b.islandsControlled !== a.islandsControlled) return b.islandsControlled - a.islandsControlled;
      // More galleons wins (tiebreaker 4)
      return b.galleonsOnBoard - a.galleonsOnBoard;
    });

    const winner = playerScores[0];

    return {
      winner: winner.playerId,
      finalScores: playerScores
    };
  },

  /**
   * Minimum and maximum players
   */
  minPlayers: 2,
  maxPlayers: 4
};
