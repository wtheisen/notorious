import { AnyChart, TreasureMapChart, IslandRaidChart, SmugglerRouteChart, ChartFactory, IslandName } from './Chart';
import { Island } from './Island';

/**
 * Manages the chart deck including draw pile, discard pile, and active Island Raids
 * Handles chart distribution, drawing, and Island Raid growth
 */
export class ChartDeck {
  private drawPile: AnyChart[];
  private discardPile: AnyChart[];
  private activeIslandRaids: IslandRaidChart[];
  private allIslandRaids: IslandRaidChart[]; // Both revealed and unrevealed
  private playerCount: number;

  constructor() {
    this.drawPile = [];
    this.discardPile = [];
    this.activeIslandRaids = [];
    this.allIslandRaids = [];
    this.playerCount = 0;
  }

  /**
   * Initialize the chart deck
   * Called during game setup after islands are placed
   *
   * @param playerCount Number of players in the game
   * @param placedIslands The 5 islands that were placed on the board
   * @param remainingTreasureMaps The 14 Treasure Maps that weren't used for island placement
   */
  initializeDeck(
    playerCount: number,
    placedIslands: Island[],
    remainingTreasureMaps: TreasureMapChart[]
  ): void {
    this.playerCount = playerCount;
    this.drawPile = [];
    this.discardPile = [];

    // Create all 10 Smuggler Routes
    const allSmugglerRoutes = ChartFactory.createAllSmugglerRoutes();

    // Create 2 Island Raids (assign to random islands)
    const shuffledIslands = this.shuffle([...placedIslands]);
    this.allIslandRaids = [
      ChartFactory.createIslandRaid(shuffledIslands[0].name as IslandName),
      ChartFactory.createIslandRaid(shuffledIslands[1].name as IslandName)
    ];

    // Reveal the first Island Raid
    this.activeIslandRaids = [this.allIslandRaids[0]];

    // Initial draw pile: 14 Treasure Maps + 10 Smuggler Routes = 24 cards
    // Note: During setup, players will be dealt Smuggler Routes and return some
    // Those returned routes will be added back to the draw pile
    this.drawPile = [
      ...remainingTreasureMaps,
      ...allSmugglerRoutes
    ];

    // Shuffle the draw pile
    this.shuffle(this.drawPile);
  }

  /**
   * Draw charts from the deck
   * @param count Number of charts to draw
   * @returns Array of drawn charts
   */
  drawCharts(count: number): AnyChart[] {
    const drawn: AnyChart[] = [];

    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        // Reshuffle discard pile into draw pile if draw pile is empty
        if (this.discardPile.length > 0) {
          console.log('[ChartDeck] Draw pile empty, reshuffling discard pile');
          this.drawPile = [...this.discardPile];
          this.discardPile = [];
          this.shuffle(this.drawPile);
        } else {
          console.warn('[ChartDeck] No more charts to draw!');
          break;
        }
      }

      const chart = this.drawPile.pop();
      if (chart) {
        drawn.push(chart);
      }
    }

    return drawn;
  }

  /**
   * Discard a chart
   * @param chart The chart to discard
   */
  discardChart(chart: AnyChart): void {
    this.discardPile.push(chart);
  }

  /**
   * Discard multiple charts
   * @param charts The charts to discard
   */
  discardCharts(charts: AnyChart[]): void {
    this.discardPile.push(...charts);
  }

  /**
   * Get the active (revealed) Island Raids
   * @returns Array of active Island Raid charts
   */
  getActiveIslandRaids(): IslandRaidChart[] {
    return [...this.activeIslandRaids];
  }

  /**
   * Add doubloons to all unclaimed Island Raids
   * Called during each Pirate Phase
   */
  addDoubloonsToIslandRaids(): void {
    for (const raid of this.activeIslandRaids) {
      raid.doubloonsOnChart++;
      console.log(`[ChartDeck] Added doubloon to ${raid.targetIsland} Island Raid (now has ${raid.doubloonsOnChart})`);
    }
  }

  /**
   * Reveal the second Island Raid
   * Called when any player reaches 12 notoriety
   */
  revealSecondIslandRaid(): void {
    if (this.activeIslandRaids.length >= 2) {
      console.warn('[ChartDeck] Second Island Raid already revealed');
      return;
    }

    if (this.allIslandRaids.length < 2) {
      console.error('[ChartDeck] No second Island Raid to reveal!');
      return;
    }

    const secondRaid = this.allIslandRaids[1];
    this.activeIslandRaids.push(secondRaid);
    console.log(`[ChartDeck] Revealed second Island Raid: ${secondRaid.targetIsland}`);
  }

  /**
   * Remove an Island Raid when claimed
   * @param raidId The ID of the claimed raid
   */
  removeIslandRaid(raidId: string): void {
    const index = this.activeIslandRaids.findIndex(r => r.id === raidId);
    if (index !== -1) {
      const raid = this.activeIslandRaids.splice(index, 1)[0];
      console.log(`[ChartDeck] Island Raid claimed: ${raid.targetIsland}`);
    }
  }

  /**
   * Get the number of cards remaining in the draw pile
   * @returns Number of cards in draw pile
   */
  getRemainingCards(): number {
    return this.drawPile.length;
  }

  /**
   * Get the number of cards in the discard pile
   * @returns Number of cards in discard pile
   */
  getDiscardedCards(): number {
    return this.discardPile.length;
  }

  /**
   * Fisher-Yates shuffle algorithm
   * @param array Array to shuffle
   * @returns The shuffled array (mutates in place)
   */
  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Get the player count
   * Used for calculating Treasure Map rewards
   */
  getPlayerCount(): number {
    return this.playerCount;
  }

  /**
   * Find a chart by ID in the draw pile
   * Useful for testing or debugging
   */
  findChartInDrawPile(chartId: string): AnyChart | undefined {
    return this.drawPile.find(c => c.id === chartId);
  }

  /**
   * Get all charts for debugging
   */
  getAllCharts(): {
    drawPile: AnyChart[];
    discardPile: AnyChart[];
    activeIslandRaids: IslandRaidChart[];
  } {
    return {
      drawPile: [...this.drawPile],
      discardPile: [...this.discardPile],
      activeIslandRaids: [...this.activeIslandRaids]
    };
  }
}
