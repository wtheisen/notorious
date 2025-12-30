import { BaseAction } from './Action';
import { ActionType, ActionResult, ValidationResult } from '../types/GameTypes';
import { GameState } from '../core/GameState';
import { AnyChart } from '../core/Chart';

/**
 * Chart Action: Draw two charts and keep one. Gain the Wind Token.
 *
 * Base: Draw 2 charts, keep 1
 * Bribe 1: Draw 3 instead of 2
 * Bribe 2: Keep 2 instead of 1
 *
 * This action has a two-phase execution:
 * 1. First execute: Draw charts, return them for UI selection
 * 2. Second execute (after selection): Add selected charts to player hand
 */
export class ChartAction extends BaseAction {
  private drawExtra: boolean; // If true, draw 3 instead of 2
  private keepExtra: boolean; // If true, keep 2 instead of 1
  private selectedChartIds: string[]; // IDs of charts player chose to keep
  private drawnCharts: AnyChart[] | null; // Charts that were drawn (for UI)

  constructor(
    playerId: string,
    bribesUsed: number = 0,
    drawExtra: boolean = false,
    keepExtra: boolean = false,
    selectedChartIds: string[] = []
  ) {
    super(ActionType.CHART, playerId, bribesUsed);
    this.drawExtra = drawExtra;
    this.keepExtra = keepExtra;
    this.selectedChartIds = selectedChartIds;
    this.drawnCharts = null;
  }

  validate(gameState: GameState): ValidationResult {
    const playerCheck = this.validatePlayer(gameState);
    if (!playerCheck.valid) return playerCheck;

    const player = this.getPlayer(gameState)!;

    // Check player has enough doubloons for bribes
    if (this.bribesUsed > player.doubloons) {
      return { valid: false, reason: 'Not enough doubloons for bribes' };
    }

    // If selection phase, validate selection
    if (this.selectedChartIds.length > 0) {
      const keepCount = this.keepExtra ? 2 : 1;
      if (this.selectedChartIds.length !== keepCount) {
        return {
          valid: false,
          reason: `Must select exactly ${keepCount} chart(s) to keep`
        };
      }
    }

    return { valid: true };
  }

  execute(gameState: GameState): ActionResult {
    const validation = this.validate(gameState);
    if (!validation.valid) {
      return this.createFailureResult(validation.reason || 'Invalid action');
    }

    const player = this.getPlayer(gameState)!;
    const drawCount = this.drawExtra ? 3 : 2;
    const keepCount = this.keepExtra ? 2 : 1;

    // If no selection has been made yet, draw charts and return for UI
    if (this.selectedChartIds.length === 0 && this.drawnCharts === null) {
      // Spend doubloons for bribes
      if (this.bribesUsed > 0) {
        player.spendDoubloons(this.bribesUsed);
        console.log(`[ChartAction] ${player.name} spent ${this.bribesUsed} doubloon(s) for bribes`);
      }

      // Draw charts from deck
      const drawnCharts = gameState.chartDeck.drawCharts(drawCount);
      this.drawnCharts = drawnCharts;

      console.log(`[ChartAction] ${player.name} drew ${drawnCharts.length} charts`);

      // Return special result that signals UI to show chart selection
      return {
        success: false, // Not complete yet
        message: 'CHART_SELECTION_REQUIRED',
        notorietyGained: 0,
        doubloonsGained: 0,
        drawnCharts: drawnCharts // Include drawn charts for UI
      };
    }

    // Selection has been made - finalize the action
    const chartsToKeep: AnyChart[] = [];
    const chartsToDiscard: AnyChart[] = [];

    // Use the previously drawn charts or draw new ones
    const charts = this.drawnCharts || gameState.chartDeck.drawCharts(drawCount);

    // Sort charts into keep and discard based on selection
    for (const chart of charts) {
      if (this.selectedChartIds.includes(chart.id)) {
        chartsToKeep.push(chart);
      } else {
        chartsToDiscard.push(chart);
      }
    }

    // Add kept charts to player's hand
    for (const chart of chartsToKeep) {
      player.addChart(chart);
    }

    // Discard the rest
    gameState.chartDeck.discardCharts(chartsToDiscard);

    // Give the Wind token
    gameState.giveWindToken(this.playerId);

    console.log(`[ChartAction] ${player.name} kept ${chartsToKeep.length} chart(s), discarded ${chartsToDiscard.length}`);

    gameState.forceUpdate();

    return this.createSuccessResult(
      `Drew ${drawCount}, kept ${keepCount}. Gained Wind token`,
      0,
      0
    );
  }

  describe(): string {
    const drawCount = this.drawExtra ? 3 : 2;
    const keepCount = this.keepExtra ? 2 : 1;
    return `Chart: Draw ${drawCount}, keep ${keepCount}, gain Wind token`;
  }

  /**
   * Get bribe cost for this action
   * Each bribe costs 1 doubloon
   */
  getBribeCost(): number {
    return this.bribesUsed;
  }

  /**
   * Create a ChartAction with selection already made
   * Used when re-executing after UI selection
   */
  static createWithSelection(
    playerId: string,
    bribesUsed: number,
    drawExtra: boolean,
    keepExtra: boolean,
    selectedChartIds: string[]
  ): ChartAction {
    return new ChartAction(playerId, bribesUsed, drawExtra, keepExtra, selectedChartIds);
  }

  /**
   * Helper: Create a standard Chart action (no bribes)
   */
  static createStandard(playerId: string): ChartAction {
    return new ChartAction(playerId, 0, false, false);
  }

  /**
   * Helper: Create Chart action with draw extra bribe
   */
  static createDrawExtra(playerId: string): ChartAction {
    return new ChartAction(playerId, 1, true, false);
  }

  /**
   * Helper: Create Chart action with keep extra bribe
   */
  static createKeepExtra(playerId: string): ChartAction {
    return new ChartAction(playerId, 1, false, true);
  }

  /**
   * Helper: Create Chart action with both bribes
   */
  static createBothBribes(playerId: string): ChartAction {
    return new ChartAction(playerId, 2, true, true);
  }
}
