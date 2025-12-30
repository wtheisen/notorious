import { BaseAction } from './Action';
import { ActionType, ActionResult, ValidationResult } from '../types/GameTypes';
import { GameState } from '../core/GameState';
import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart } from '../core/Chart';
import { ChartType } from '../types/GameTypes';
import { ChartValidator } from '../core/ChartValidator';

/**
 * Claim Chart Action
 * Used during Pirate Phase to turn in completed charts for rewards
 *
 * Requirements vary by chart type:
 * - Treasure Map: Galleon + control of hex, reward = 1 doubloon per player
 * - Island Raid: Galleon + control of island + 2+ doubloons on chart, reward = 4 notoriety + doubloons
 * - Smuggler Route: Path of ships between islands, reward = path length in doubloons
 */
export class ClaimChartAction extends BaseAction {
  private chartId: string;

  constructor(playerId: string, chartId: string) {
    super(ActionType.CHART, playerId, 0); // No bribes for claiming
    this.chartId = chartId;
  }

  validate(gameState: GameState): ValidationResult {
    const playerCheck = this.validatePlayer(gameState);
    if (!playerCheck.valid) return playerCheck;

    const player = this.getPlayer(gameState)!;

    // Find the chart (either in player's hand or active Island Raids)
    let chart: AnyChart | undefined = player.charts.find(c => c.id === this.chartId);

    if (!chart) {
      // Check if it's a public Island Raid
      const activeRaids = gameState.chartDeck.getActiveIslandRaids();
      chart = activeRaids.find(r => r.id === this.chartId);
    }

    if (!chart) {
      return { valid: false, reason: 'Chart not found' };
    }

    // Validate based on chart type
    const validator = new ChartValidator();

    switch (chart.type) {
      case ChartType.TREASURE_MAP:
        return validator.canClaimTreasureMap(chart as TreasureMapChart, player.id, gameState.board);

      case ChartType.ISLAND_RAID:
        return validator.canClaimIslandRaid(chart as IslandRaidChart, player.id, gameState.board);

      case ChartType.SMUGGLER_ROUTE:
        return validator.canClaimSmugglerRoute(chart as SmugglerRouteChart, player.id, gameState.board);

      default:
        return { valid: false, reason: 'Unknown chart type' };
    }
  }

  execute(gameState: GameState): ActionResult {
    const validation = this.validate(gameState);
    if (!validation.valid) {
      return this.createFailureResult(validation.reason || 'Invalid claim');
    }

    const player = this.getPlayer(gameState)!;

    // Find the chart
    let chart: AnyChart | undefined = player.charts.find(c => c.id === this.chartId);
    let isIslandRaid = false;

    if (!chart) {
      // It's a public Island Raid
      const activeRaids = gameState.chartDeck.getActiveIslandRaids();
      chart = activeRaids.find(r => r.id === this.chartId);
      isIslandRaid = true;
    }

    if (!chart) {
      return this.createFailureResult('Chart not found');
    }

    let notoriety = 0;
    let doubloons = 0;
    let message = '';

    // Award rewards based on chart type
    switch (chart.type) {
      case ChartType.TREASURE_MAP: {
        const treasureMap = chart as TreasureMapChart;
        doubloons = gameState.players.length; // 1 per player in game
        message = `Claimed Treasure Map at (${treasureMap.targetHex.q}, ${treasureMap.targetHex.r})`;
        break;
      }

      case ChartType.ISLAND_RAID: {
        const islandRaid = chart as IslandRaidChart;
        notoriety = islandRaid.notorietyReward; // Always 4
        doubloons = islandRaid.doubloonsOnChart;
        message = `Raided ${islandRaid.targetIsland}`;
        break;
      }

      case ChartType.SMUGGLER_ROUTE: {
        const smugglerRoute = chart as SmugglerRouteChart;
        const validator = new ChartValidator();
        doubloons = validator.calculateSmugglerRouteReward(smugglerRoute, gameState.board);
        message = `Completed Smuggler Route: ${smugglerRoute.islandA} to ${smugglerRoute.islandB}`;
        break;
      }
    }

    // Award rewards
    if (notoriety > 0) {
      player.gainNotoriety(notoriety);
    }
    if (doubloons > 0) {
      player.gainDoubloons(doubloons);
    }

    // Remove chart from player's hand (one-time use)
    if (!isIslandRaid) {
      player.removeChart(this.chartId);
    }

    // Discard the chart
    if (isIslandRaid) {
      // Remove from active Island Raids
      gameState.chartDeck.removeIslandRaid(this.chartId);
    } else {
      // Add to discard pile
      gameState.chartDeck.discardChart(chart);
    }

    console.log(`[ClaimChartAction] ${player.name} claimed ${chart.type}: +${notoriety} notoriety, +${doubloons} doubloons`);

    gameState.forceUpdate();

    return this.createSuccessResult(message, notoriety, doubloons);
  }

  describe(): string {
    return `Claim Chart`;
  }

  /**
   * Helper: Create a ClaimChartAction for a specific chart
   */
  static create(playerId: string, chartId: string): ClaimChartAction {
    return new ClaimChartAction(playerId, chartId);
  }
}
