import { ActionType, ActionResult, ValidationResult } from '../types/GameTypes';
import { GameState } from '../core/GameState';

/**
 * Base interface for all actions in the game
 */
export interface Action {
  type: ActionType;
  playerId: string;
  bribesUsed: number;

  /**
   * Validate if this action can be executed
   */
  validate(gameState: GameState): ValidationResult;

  /**
   * Execute the action
   */
  execute(gameState: GameState): ActionResult;

  /**
   * Get a description of this action
   */
  describe(): string;

  /**
   * Calculate the cost in doubloons for bribes
   */
  getBribeCost(): number;
}

/**
 * Abstract base class for actions
 */
export abstract class BaseAction implements Action {
  public readonly type: ActionType;
  public readonly playerId: string;
  public bribesUsed: number;

  constructor(type: ActionType, playerId: string, bribesUsed: number = 0) {
    this.type = type;
    this.playerId = playerId;
    this.bribesUsed = bribesUsed;
  }

  abstract validate(gameState: GameState): ValidationResult;
  abstract execute(gameState: GameState): ActionResult;
  abstract describe(): string;

  getBribeCost(): number {
    return this.bribesUsed;
  }

  protected getPlayer(gameState: GameState) {
    return gameState.getPlayer(this.playerId);
  }

  protected createSuccessResult(message: string, notoriety: number = 0, doubloons: number = 0): ActionResult {
    return {
      success: true,
      message,
      notorietyGained: notoriety,
      doubloonsGained: doubloons,
      doubloonsSpent: this.bribesUsed
    };
  }

  protected createFailureResult(message: string): ActionResult {
    return {
      success: false,
      message,
      doubloonsSpent: 0
    };
  }

  protected validatePlayer(gameState: GameState): ValidationResult {
    const player = this.getPlayer(gameState);
    if (!player) {
      return { valid: false, reason: 'Player not found' };
    }
    return { valid: true };
  }
}
