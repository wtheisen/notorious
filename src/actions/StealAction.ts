import { BaseAction } from './Action';
import { ActionType, ActionResult, ValidationResult, ShipType } from '../types/GameTypes';
import { GameState } from '../core/GameState';
import { HexCoord } from '../types/CoordinateTypes';
import { Ship } from '../core/Ship';

/**
 * Steal Action: Replace an opponent's Sloop with one of yours
 * in a Hex containing at least one of your pieces.
 *
 * No bribes for this action.
 */
export class StealAction extends BaseAction {
  private targetHex: HexCoord;
  private targetPlayerId: string;

  constructor(playerId: string, targetHex: HexCoord, targetPlayerId: string) {
    super(ActionType.STEAL, playerId, 0); // No bribes
    this.targetHex = targetHex;
    this.targetPlayerId = targetPlayerId;
  }

  validate(gameState: GameState): ValidationResult {
    const playerCheck = this.validatePlayer(gameState);
    if (!playerCheck.valid) return playerCheck;

    const player = this.getPlayer(gameState)!;
    const board = gameState.board;
    const hex = board.getHex(this.targetHex);

    if (!hex) {
      return { valid: false, reason: 'Invalid hex coordinate' };
    }

    // Check player has at least one piece in this hex
    const playerShips = hex.getPlayerShips(this.playerId);
    if (playerShips.length === 0) {
      return { valid: false, reason: 'You have no pieces in this hex' };
    }

    // Check target has a sloop in this hex
    const targetShips = hex.getPlayerShips(this.targetPlayerId);
    const hasSloop = targetShips.some(s => s.type === ShipType.SLOOP);
    if (!hasSloop) {
      return { valid: false, reason: 'Target has no sloop in this hex' };
    }

    // Check player has a sloop to place (optional - can steal without replacement)
    // For now we'll allow stealing even without a sloop to place

    return { valid: true };
  }

  execute(gameState: GameState): ActionResult {
    const validation = this.validate(gameState);
    if (!validation.valid) {
      return this.createFailureResult(validation.reason || 'Invalid action');
    }

    const player = this.getPlayer(gameState)!;
    const board = gameState.board;
    const hex = board.getHex(this.targetHex)!;

    // Remove opponent's sloop
    const targetShips = hex.getPlayerShips(this.targetPlayerId);
    const sloopToRemove = targetShips.find(s => s.type === ShipType.SLOOP)!;
    hex.removeShip(sloopToRemove);

    // Return ship to opponent's inventory
    const opponent = gameState.getPlayer(this.targetPlayerId);
    if (opponent) {
      opponent.returnShips('sloops', 1);
    }

    // Place player's sloop if they have one
    if (player.hasShips('sloops', 1)) {
      const newSloop = Ship.createSloop(this.playerId);
      hex.addShip(newSloop);
      player.spendShips('sloops', 1);
    }

    gameState.forceUpdate();

    return this.createSuccessResult('Stole opponent\'s sloop');
  }

  describe(): string {
    return `Steal: Replace opponent's sloop`;
  }
}
