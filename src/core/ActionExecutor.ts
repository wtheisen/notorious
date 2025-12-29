import { Action } from '../actions/Action';
import { GameState } from './GameState';
import { ActionResult, ValidationResult, GamePhase } from '../types/GameTypes';

/**
 * Executes and validates actions in the game
 */
export class ActionExecutor {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Validate an action
   */
  validate(action: Action): ValidationResult {
    // Check if it's the right phase
    if (this.gameState.currentPhase !== GamePhase.PLAY) {
      return { valid: false, reason: 'Can only execute actions during PLAY phase' };
    }

    // Check if it's the player's turn
    const activePlayer = this.gameState.getActivePlayer();
    if (!activePlayer || activePlayer.id !== action.playerId) {
      return { valid: false, reason: 'Not your turn' };
    }

    // Validate the action itself
    return action.validate(this.gameState);
  }

  /**
   * Execute an action
   */
  execute(action: Action): ActionResult {
    // Validate first
    const validation = this.validate(action);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.reason || 'Invalid action',
        doubloonsSpent: 0
      };
    }

    // Execute the action
    const result = action.execute(this.gameState);

    // Log the action
    if (result.success) {
      console.log(`[ActionExecutor] ${action.describe()} - ${result.message}`);
    }

    return result;
  }

  /**
   * Get all valid actions for the current player
   * (For AI or UI suggestions)
   */
  getValidActions(): Action[] {
    // This would be implemented to generate all possible valid actions
    // For now, return empty array
    return [];
  }
}
