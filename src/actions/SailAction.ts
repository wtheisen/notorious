import { BaseAction } from './Action';
import { ActionType, ActionResult, ValidationResult, ShipType } from '../types/GameTypes';
import { GameState } from '../core/GameState';
import { HexCoord } from '../types/CoordinateTypes';
import { Ship } from '../core/Ship';
import { hexDistance } from '../utils/HexMath';

/**
 * Sail Action: Move a Ship two Hexes, or two Ships one Hex each.
 *
 * Bribe: Move a Ship one Hex.
 */
export class SailAction extends BaseAction {
  private moves: Array<{ ship: ShipType; from: HexCoord; to: HexCoord }>;

  constructor(
    playerId: string,
    moves: Array<{ ship: ShipType; from: HexCoord; to: HexCoord }>,
    bribesUsed: number = 0
  ) {
    super(ActionType.SAIL, playerId, bribesUsed);
    this.moves = moves;
  }

  validate(gameState: GameState): ValidationResult {
    const playerCheck = this.validatePlayer(gameState);
    if (!playerCheck.valid) return playerCheck;

    const player = this.getPlayer(gameState)!;
    const board = gameState.board;

    // Check player has enough doubloons for bribes
    if (this.bribesUsed > player.doubloons) {
      return { valid: false, reason: 'Not enough doubloons for bribes' };
    }

    // Validate each move
    for (const move of this.moves) {
      const fromHex = board.getHex(move.from);
      const toHex = board.getHex(move.to);

      if (!fromHex || !toHex) {
        return { valid: false, reason: 'Invalid hex coordinates' };
      }

      // Check player has a ship of this type in the from hex
      const playerShips = fromHex.getPlayerShips(this.playerId);
      const hasShip = playerShips.some(s => s.type === move.ship);
      if (!hasShip) {
        return { valid: false, reason: `No ${move.ship} at source hex` };
      }

      // Check path is valid (considering islands)
      if (!this.isValidPath(move.from, move.to, board)) {
        return { valid: false, reason: 'Invalid path (blocked by island or too far)' };
      }
    }

    return { valid: true };
  }

  /**
   * Check if a path between two hexes is valid
   * For simplicity, we check direct adjacency for each step
   */
  private isValidPath(from: HexCoord, to: HexCoord, board: any): boolean {
    const distance = hexDistance(from, to);

    // For now, only allow direct adjacency moves
    // Full pathfinding would be needed for multi-hex moves
    if (distance === 1) {
      return board.canSailBetween(from, to);
    }

    // For 2-hex moves, check there's a valid intermediate hex
    if (distance === 2) {
      const neighbors = board.getNeighbors(from);
      for (const neighbor of neighbors) {
        if (hexDistance(neighbor.coord, to) === 1) {
          if (board.canSailBetween(from, neighbor.coord) &&
              board.canSailBetween(neighbor.coord, to)) {
            return true;
          }
        }
      }
      return false;
    }

    return false;
  }

  execute(gameState: GameState): ActionResult {
    const validation = this.validate(gameState);
    if (!validation.valid) {
      return this.createFailureResult(validation.reason || 'Invalid action');
    }

    const player = this.getPlayer(gameState)!;
    const board = gameState.board;

    // Spend doubloons for bribes
    if (this.bribesUsed > 0) {
      player.spendDoubloons(this.bribesUsed);
    }

    // Execute moves
    for (const move of this.moves) {
      const fromHex = board.getHex(move.from)!;
      const playerShips = fromHex.getPlayerShips(this.playerId);
      const shipToMove = playerShips.find(s => s.type === move.ship)!;

      board.moveShip(move.from, move.to, shipToMove);
    }

    gameState.forceUpdate();

    return this.createSuccessResult(`Sailed ${this.moves.length} ship(s)`);
  }

  describe(): string {
    return `Sail: Move ${this.moves.length} ship(s)`;
  }

  /**
   * Helper: Create a sail action for moving one ship two hexes
   */
  static createSingleShipMove(
    playerId: string,
    ship: ShipType,
    from: HexCoord,
    to: HexCoord,
    bribes: number = 0
  ): SailAction {
    return new SailAction(playerId, [{ ship, from, to }], bribes);
  }

  /**
   * Helper: Create a sail action for moving two ships one hex each
   */
  static createTwoShipMove(
    playerId: string,
    ship1: ShipType,
    from1: HexCoord,
    to1: HexCoord,
    ship2: ShipType,
    from2: HexCoord,
    to2: HexCoord,
    bribes: number = 0
  ): SailAction {
    return new SailAction(
      playerId,
      [
        { ship: ship1, from: from1, to: to1 },
        { ship: ship2, from: from2, to: to2 }
      ],
      bribes
    );
  }
}
