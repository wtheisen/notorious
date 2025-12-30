import { GameState } from './GameState';
import { GamePhase, ActionType, GAME_CONSTANTS } from '../types/GameTypes';
import { IslandPlacer } from './IslandPlacer';

/**
 * Manages game phase transitions and phase-specific logic
 */
export class PhaseManager {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Execute the Place Phase
   * Players take turns placing Captains on action slots
   */
  executePlacePhase(): void {
    console.log('[PhaseManager] Starting PLACE phase');
    this.gameState.currentPhase = GamePhase.PLACE;

    // Reset all players' captain placements for new round
    for (const player of this.gameState.players) {
      player.resetCaptains();
    }

    // Reset to first player
    this.gameState.activePlayerIndex = 0;

    this.gameState.forceUpdate();
  }

  /**
   * Check if all players have placed all their captains
   */
  public allCaptainsPlaced(): boolean {
    return this.gameState.players.every(player => !player.hasUnplacedCaptains());
  }

  /**
   * Execute the Play Phase
   * Players take turns executing actions
   */
  executePlayPhase(): void {
    console.log('[PhaseManager] Starting PLAY phase');
    this.gameState.currentPhase = GamePhase.PLAY;

    // Reset to first player at start of PLAY phase
    this.gameState.activePlayerIndex = 0;

    this.gameState.forceUpdate();

    // Players will execute actions via ActionExecutor
    // Phase continues until all players have taken their actions
  }

  /**
   * Execute the Pirate Phase
   * Award notoriety for hex control, check charts, etc.
   */
  executePiratePhase(): void {
    console.log('[PhaseManager] Starting PIRATE phase');
    this.gameState.currentPhase = GamePhase.PIRATE;

    // Award notoriety for hex control
    this.awardNotorietyForControl();

    // NEW: Add doubloons to unclaimed Island Raids
    this.gameState.chartDeck.addDoubloonsToIslandRaids();

    // NEW: Check if 2nd Island Raid should be revealed
    this.checkIslandRaidReveal();

    // Check for captain unlocks
    this.checkCaptainUnlocks();

    // Check for game end
    if (this.gameState.checkGameEnd()) {
      this.gameState.currentPhase = GamePhase.GAME_OVER;
      console.log('[PhaseManager] Game Over!');
    } else {
      // Move to next round
      this.gameState.nextPhase();
    }

    this.gameState.forceUpdate();
  }

  /**
   * Award notoriety to players based on hex control
   */
  private awardNotorietyForControl(): void {
    const board = this.gameState.board;

    for (const player of this.gameState.players) {
      const controlledHexes = board.getControlledHexes(player.id);
      const notoriety = controlledHexes.length;

      if (notoriety > 0) {
        player.gainNotoriety(notoriety);
        console.log(`[PhaseManager] ${player.name} gained ${notoriety} notoriety (${controlledHexes.length} hexes)`);
      }
    }
  }

  /**
   * Check if players should unlock new captains
   */
  private checkCaptainUnlocks(): void {
    for (const player of this.gameState.players) {
      // Captain unlocks are handled automatically in Player.gainNotoriety()
      // This is just for logging
      if (player.notoriety >= GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS[0] &&
          player.notoriety < GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS[0] + 1) {
        console.log(`[PhaseManager] ${player.name} unlocked 3rd captain!`);
      }
      if (player.notoriety >= GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS[1] &&
          player.notoriety < GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS[1] + 1) {
        console.log(`[PhaseManager] ${player.name} unlocked 4th captain!`);
      }
    }
  }

  /**
   * Advance to next phase
   */
  advancePhase(): void {
    switch (this.gameState.currentPhase) {
      case GamePhase.SETUP:
        this.executePlacePhase();
        break;
      case GamePhase.PLACE:
        this.executePlayPhase();
        break;
      case GamePhase.PLAY:
        this.executePiratePhase();
        break;
      case GamePhase.PIRATE:
        this.executePlacePhase();
        break;
      default:
        console.warn('[PhaseManager] Cannot advance from current phase');
    }
  }

  /**
   * End the current player's turn
   */
  endTurn(): void {
    const activePlayer = this.gameState.getActivePlayer();
    const previousPlayerIndex = this.gameState.activePlayerIndex;
    console.log(`[PhaseManager] ${activePlayer?.name || 'Unknown'} ended turn`);

    if (this.gameState.currentPhase === GamePhase.PLACE) {
      // During PLACE phase, check if all captains are placed
      if (this.allCaptainsPlaced()) {
        console.log('[PhaseManager] All captains placed, advancing to PLAY phase');
        this.advancePhase();
        return;
      }
      // Move to next player who still has captains to place
      this.gameState.nextTurn();
    } else if (this.gameState.currentPhase === GamePhase.PLAY) {
      // Check if all players have no captains left (all actions used)
      const allCaptainsUsed = this.gameState.players.every(p => p.placedCaptains.length === 0);
      if (allCaptainsUsed) {
        console.log('[PhaseManager] All captains used, advancing to PIRATE phase');
        this.advancePhase();
        return;
      }

      // Move to next player
      this.gameState.nextTurn();

      // If we cycled back to first player from last player, check if we should continue
      const cycledToStart = previousPlayerIndex === this.gameState.players.length - 1 &&
                           this.gameState.activePlayerIndex === 0;

      if (cycledToStart && allCaptainsUsed) {
        console.log('[PhaseManager] Round complete, advancing to PIRATE phase');
        this.advancePhase();
      }
    }
  }

  /**
   * Start a new game
   */
  startGame(): void {
    console.log('[PhaseManager] Starting new game');
    this.gameState.currentPhase = GamePhase.SETUP;
    this.gameState.currentRound = 1;

    // NEW: Place islands and initialize chart deck
    this.setupIslandsAndCharts();

    this.gameState.forceUpdate();

    // Auto-advance to first real phase
    this.advancePhase();
  }

  /**
   * Setup islands and chart deck
   * Called during game initialization
   */
  private setupIslandsAndCharts(): void {
    console.log('[PhaseManager] Setting up islands and charts');

    // Place 5 islands randomly
    const islandPlacer = new IslandPlacer();
    const { islands, remainingTreasureMaps } = islandPlacer.placeIslands(this.gameState.board);

    console.log(`[PhaseManager] Placed ${islands.length} islands`);

    // Initialize chart deck with remaining Treasure Maps
    this.gameState.chartDeck.initializeDeck(
      this.gameState.players.length,
      islands,
      remainingTreasureMaps
    );

    console.log(`[PhaseManager] Initialized chart deck with ${remainingTreasureMaps.length} Treasure Maps`);

    // TODO: Deal Smuggler Routes to players (will need UI for selection)
    // For now, we skip this step - will implement in Chart Action phase
  }

  /**
   * Check if 2nd Island Raid should be revealed
   * Revealed when any player reaches 12 notoriety
   */
  private checkIslandRaidReveal(): void {
    const activeRaids = this.gameState.chartDeck.getActiveIslandRaids();
    if (activeRaids.length >= 2) {
      return; // Already revealed both
    }

    // Check if any player has reached 12 notoriety
    const hasPlayerAt12 = this.gameState.players.some(p => p.notoriety >= 12);
    if (hasPlayerAt12) {
      console.log('[PhaseManager] Player reached 12 notoriety, revealing 2nd Island Raid');
      this.gameState.chartDeck.revealSecondIslandRaid();
    }
  }
}
