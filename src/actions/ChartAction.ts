import { BaseAction } from './Action';
import { ActionType, ActionResult, ValidationResult, WindDirection } from '../types/GameTypes';
import { GameState } from '../core/GameState';

/**
 * Chart Action: Draw two charts and keep one. Gain the Wind Token.
 *
 * Bribe: Either draw another chart or keep an extra chart.
 *
 * Note: For MVP without full chart system, this mainly handles Wind token
 */
export class ChartAction extends BaseAction {
  private drawExtra: boolean; // If true, draw 3 instead of 2
  private keepExtra: boolean; // If true, keep 2 instead of 1

  constructor(
    playerId: string,
    bribesUsed: number = 0,
    drawExtra: boolean = false,
    keepExtra: boolean = false
  ) {
    super(ActionType.CHART, playerId, bribesUsed);
    this.drawExtra = drawExtra;
    this.keepExtra = keepExtra;
  }

  validate(gameState: GameState): ValidationResult {
    const playerCheck = this.validatePlayer(gameState);
    if (!playerCheck.valid) return playerCheck;

    const player = this.getPlayer(gameState)!;

    // Check player has enough doubloons for bribes
    if (this.bribesUsed > player.doubloons) {
      return { valid: false, reason: 'Not enough doubloons for bribes' };
    }

    return { valid: true };
  }

  execute(gameState: GameState): ActionResult {
    const validation = this.validate(gameState);
    if (!validation.valid) {
      return this.createFailureResult(validation.reason || 'Invalid action');
    }

    const player = this.getPlayer(gameState)!;

    // Spend doubloons for bribes
    if (this.bribesUsed > 0) {
      player.spendDoubloons(this.bribesUsed);
    }

    // Give player the Wind token (toggle wind direction)
    // Player can now control turn order direction
    // For now, we'll just award a doubloon as a placeholder reward
    player.gainDoubloons(1);

    // TODO: Implement actual chart drawing when chart system is ready
    const chartsDrawn = this.drawExtra ? 3 : 2;
    const chartsKept = this.keepExtra ? 2 : 1;

    gameState.forceUpdate();

    return this.createSuccessResult(
      `Drew ${chartsDrawn} chart(s), kept ${chartsKept}. Gained Wind token (+1 doubloon)`,
      0,
      1
    );
  }

  describe(): string {
    let desc = 'Chart: Draw charts, get Wind token';
    if (this.drawExtra) desc += ' (draw +1)';
    if (this.keepExtra) desc += ' (keep +1)';
    return desc;
  }

  /**
   * Helper: Create a standard Chart action
   */
  static createStandard(playerId: string, bribeType?: 'draw' | 'keep'): ChartAction {
    const bribes = bribeType ? 1 : 0;
    const drawExtra = bribeType === 'draw';
    const keepExtra = bribeType === 'keep';
    return new ChartAction(playerId, bribes, drawExtra, keepExtra);
  }
}
