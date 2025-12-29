import * as Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { Player } from '../core/Player';
import { PlayerColor, ActionType, GamePhase, ShipType } from '../types/GameTypes';
import { HexRenderer } from '../rendering/HexRenderer';
import { ShipRenderer } from '../rendering/ShipRenderer';
import { HexCoord, createHexCoord } from '../types/CoordinateTypes';
import { GAME_SETTINGS } from '../config/GameConfig';
import { Ship } from '../core/Ship';
import { ActionExecutor } from '../core/ActionExecutor';
import { PhaseManager } from '../core/PhaseManager';
import { UIScene } from './UIScene';
import { BuildAction } from '../actions/BuildAction';
import { SailAction } from '../actions/SailAction';
import { StealAction } from '../actions/StealAction';
import { SinkAction } from '../actions/SinkAction';
import { ChartAction } from '../actions/ChartAction';

/**
 * Main game scene - renders the board and handles gameplay
 */
export class GameScene extends Phaser.Scene {
  private gameState!: GameState;
  private hexRenderer!: HexRenderer;
  private shipRenderer!: ShipRenderer;
  private actionExecutor!: ActionExecutor;
  private phaseManager!: PhaseManager;
  private uiScene!: UIScene;

  // Action selection state
  private selectedHex: HexCoord | null = null;
  private selectedAction: ActionType | null = null;
  private actionStartHex: HexCoord | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    console.log('GameScene created');

    // Initialize renderers
    this.hexRenderer = new HexRenderer(
      this,
      GAME_SETTINGS.BOARD_CENTER_X,
      GAME_SETTINGS.BOARD_CENTER_Y
    );
    this.shipRenderer = new ShipRenderer(
      this,
      GAME_SETTINGS.BOARD_CENTER_X,
      GAME_SETTINGS.BOARD_CENTER_Y
    );

    // Initialize game state
    this.gameState = new GameState();

    // Create managers
    this.actionExecutor = new ActionExecutor(this.gameState);
    this.phaseManager = new PhaseManager(this.gameState);

    // Create test players
    const player1 = new Player('player1', 'Player', PlayerColor.BLUE, false);
    const player2 = new Player('ai1', 'AI', PlayerColor.RED, true);

    this.gameState.initialize([player1, player2]);

    // Subscribe to game state changes
    this.gameState.addObserver(() => this.onStateChanged());

    // Set up test scenario: place some ships
    this.setupTestScenario();

    // Start the UI scene
    this.scene.launch('UIScene', { gameState: this.gameState });
    this.uiScene = this.scene.get('UIScene') as UIScene;

    // Wire up UI callbacks
    this.uiScene.onActionSelected = (actionType) => this.onActionSelected(actionType);
    this.uiScene.onCaptainPlaced = (actionType) => this.onCaptainPlaced(actionType);
    this.uiScene.onEndTurn = () => this.onEndTurn();
    this.uiScene.onNextPhase = () => this.onNextPhase();

    // Enable input
    this.input.on('pointerdown', this.onPointerDown, this);

    // Start the game
    this.phaseManager.startGame();

    // Initial render
    this.renderBoard();
  }

  /**
   * Set up a test scenario with some ships placed
   */
  private setupTestScenario(): void {
    const board = this.gameState.board;

    // Place player 1's port and some ships
    const player1PortHex = createHexCoord(0, 0); // Center
    board.placeShip(player1PortHex, Ship.createPort('player1'));
    board.placeShip(player1PortHex, Ship.createSloop('player1'));
    this.gameState.getPlayer('player1')!.setPortLocation(player1PortHex);

    // Place some player 1 ships in neighboring hexes
    board.placeShip(createHexCoord(1, 0), Ship.createGalleon('player1'));
    board.placeShip(createHexCoord(1, 0), Ship.createSloop('player1'));

    // Place AI's port and ships
    const ai1PortHex = createHexCoord(-2, 2);
    board.placeShip(ai1PortHex, Ship.createPort('ai1'));
    board.placeShip(ai1PortHex, Ship.createSloop('ai1'));
    this.gameState.getPlayer('ai1')!.setPortLocation(ai1PortHex);

    // Place some AI ships
    board.placeShip(createHexCoord(-1, 2), Ship.createGalleon('ai1'));
    board.placeShip(createHexCoord(0, 2), Ship.createSloop('ai1'));
    board.placeShip(createHexCoord(0, 2), Ship.createSloop('ai1'));
  }

  /**
   * Render the entire board
   */
  private renderBoard(): void {
    // Clear previous renders
    this.hexRenderer.clear();
    this.shipRenderer.clear();

    const board = this.gameState.board;

    // Render all hexes
    for (const hex of board.getAllHexes()) {
      const controller = hex.getController();
      this.hexRenderer.drawHex(hex, controller);
    }

    // Highlight selected hex if any
    if (this.selectedHex) {
      this.hexRenderer.highlightHex(this.selectedHex, 0xffff00);
    }

    // Highlight action start hex if any
    if (this.actionStartHex) {
      this.hexRenderer.highlightHex(this.actionStartHex, 0x00ff00);
    }

    // Render all ships
    for (const hex of board.getAllHexes()) {
      if (!hex.isEmpty()) {
        this.shipRenderer.renderShips(hex);
      }
    }
  }

  /**
   * Handle state changes
   */
  private onStateChanged(): void {
    this.renderBoard();
  }

  /**
   * Handle action button selection
   */
  private onActionSelected(actionType: ActionType): void {
    console.log(`[GameScene] Action selected: ${actionType}`);
    this.selectedAction = actionType;
    this.actionStartHex = null;
    this.selectedHex = null;
  }

  /**
   * Handle captain placement during PLACE phase
   */
  private onCaptainPlaced(actionType: ActionType): void {
    const activePlayer = this.gameState.getActivePlayer();
    if (!activePlayer || activePlayer.isAI) {
      console.log('[GameScene] Not player\'s turn');
      return;
    }

    // Try to place captain
    if (activePlayer.placeCaptain(actionType)) {
      console.log(`[GameScene] Placed captain on ${actionType}`);
      this.gameState.forceUpdate(); // Trigger UI update

      // Check if all players have placed all captains
      if (this.phaseManager.allCaptainsPlaced()) {
        console.log('[GameScene] All captains placed! Advancing to PLAY phase...');
        setTimeout(() => {
          this.phaseManager.advancePhase();
        }, 500); // Small delay for visual feedback
      } else {
        // Move to next player
        this.phaseManager.endTurn();
      }
    } else {
      console.log('[GameScene] Cannot place captain (already placed all)');
    }
  }

  /**
   * Handle end turn button
   */
  private onEndTurn(): void {
    console.log('[GameScene] End turn');
    this.phaseManager.endTurn();
    this.selectedAction = null;
    this.actionStartHex = null;
    this.selectedHex = null;
  }

  /**
   * Handle next phase button (for testing)
   */
  private onNextPhase(): void {
    console.log('[GameScene] Next phase');
    this.phaseManager.advancePhase();
  }

  /**
   * Handle pointer down events - hex selection and action execution
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const hexCoord = this.hexRenderer.pixelToHex(pointer.x, pointer.y);
    const hex = this.gameState.board.getHex(hexCoord);

    if (!hex) return;

    this.selectedHex = hexCoord;
    console.log(`Selected hex: (${hexCoord.q}, ${hexCoord.r})`);

    // Log hex information
    const controller = hex.getController();
    const ships = hex.getAllShips();
    console.log(`Controller: ${controller || 'None'}`);
    console.log(`Ships: ${ships.length}`);
    for (const ship of ships) {
      console.log(`  - ${ship.type} (${ship.playerId})`);
    }

    // Handle action execution if an action is selected
    if (this.selectedAction && this.gameState.currentPhase === GamePhase.PLAY) {
      this.handleActionExecution(hexCoord);
    }

    this.renderBoard();
  }

  /**
   * Handle action execution based on selected action and clicked hex
   */
  private handleActionExecution(hexCoord: HexCoord): void {
    const activePlayer = this.gameState.getActivePlayer();
    if (!activePlayer || activePlayer.isAI) {
      console.log('[GameScene] Not player\'s turn');
      return;
    }

    // Check if player has a captain on this action
    if (!activePlayer.placedCaptains.includes(this.selectedAction!)) {
      console.log('[GameScene] No captain on this action');
      return;
    }

    switch (this.selectedAction) {
      case ActionType.BUILD:
        this.executeBuildAction(hexCoord);
        break;
      case ActionType.SAIL:
        this.executeSailAction(hexCoord);
        break;
      case ActionType.STEAL:
        this.executeStealAction(hexCoord);
        break;
      case ActionType.SINK:
        this.executeSinkAction(hexCoord);
        break;
      case ActionType.CHART:
        this.executeChartAction();
        break;
    }
  }

  /**
   * Remove captain from action after execution
   */
  private removeCaptainFromAction(actionType: ActionType): void {
    const activePlayer = this.gameState.getActivePlayer();
    if (activePlayer) {
      const index = activePlayer.placedCaptains.indexOf(actionType);
      if (index !== -1) {
        activePlayer.placedCaptains.splice(index, 1);
        console.log(`[GameScene] Removed captain from ${actionType}. Player has ${activePlayer.placedCaptains.length} captains left`);
        this.gameState.forceUpdate(); // Trigger UI update to show captain removed

        // Automatically end turn after executing action
        console.log('[GameScene] Action executed, ending turn...');
        setTimeout(() => {
          this.phaseManager.endTurn();
        }, 500); // Small delay so player can see the result
      }
    }
  }

  /**
   * Execute Build action
   */
  private executeBuildAction(hexCoord: HexCoord): void {
    const activePlayer = this.gameState.getActivePlayer()!;

    // Simple build: 2 sloops
    const action = BuildAction.createStandard(
      activePlayer.id,
      hexCoord,
      false, // Use sloops
      0      // No bribes
    );

    const result = this.actionExecutor.execute(action);
    console.log(`[Build] ${result.message}`);

    if (result.success) {
      this.removeCaptainFromAction(ActionType.BUILD);
      this.selectedAction = null;
      this.uiScene.clearActionSelection();
    }
  }

  /**
   * Execute Sail action (needs two clicks: from and to)
   */
  private executeSailAction(hexCoord: HexCoord): void {
    const activePlayer = this.gameState.getActivePlayer()!;

    if (!this.actionStartHex) {
      // First click: select source hex
      this.actionStartHex = hexCoord;
      console.log('[Sail] Selected source hex. Click destination.');
    } else {
      // Second click: execute move
      const hex = this.gameState.board.getHex(this.actionStartHex)!;
      const ships = hex.getPlayerShips(activePlayer.id);

      if (ships.length === 0) {
        console.log('[Sail] No ships at source hex');
        this.actionStartHex = null;
        return;
      }

      // Move first ship found
      const ship = ships[0];
      const action = SailAction.createSingleShipMove(
        activePlayer.id,
        ship.type,
        this.actionStartHex,
        hexCoord,
        0 // No bribes
      );

      const result = this.actionExecutor.execute(action);
      console.log(`[Sail] ${result.message}`);

      if (result.success) {
        this.removeCaptainFromAction(ActionType.SAIL);
        this.selectedAction = null;
        this.uiScene.clearActionSelection();
      }
      this.actionStartHex = null;
    }
  }

  /**
   * Execute Steal action
   */
  private executeStealAction(hexCoord: HexCoord): void {
    const activePlayer = this.gameState.getActivePlayer()!;
    const hex = this.gameState.board.getHex(hexCoord)!;

    // Find opponent with a sloop
    const opponents = this.gameState.getOpponents(activePlayer.id);
    for (const opponent of opponents) {
      const opponentShips = hex.getPlayerShips(opponent.id);
      if (opponentShips.some(s => s.type === ShipType.SLOOP)) {
        const action = new StealAction(activePlayer.id, hexCoord, opponent.id);
        const result = this.actionExecutor.execute(action);
        console.log(`[Steal] ${result.message}`);

        if (result.success) {
          this.removeCaptainFromAction(ActionType.STEAL);
          this.selectedAction = null;
          this.uiScene.clearActionSelection();
        }
        return;
      }
    }

    console.log('[Steal] No valid target');
  }

  /**
   * Execute Sink action
   */
  private executeSinkAction(hexCoord: HexCoord): void {
    const activePlayer = this.gameState.getActivePlayer()!;
    const hex = this.gameState.board.getHex(hexCoord)!;

    // Find opponent ship to sink
    const opponents = this.gameState.getOpponents(activePlayer.id);
    for (const opponent of opponents) {
      const opponentShips = hex.getPlayerShips(opponent.id);
      if (opponentShips.length > 0) {
        const ship = opponentShips[0];
        const action = new SinkAction(activePlayer.id, hexCoord, ship.type, opponent.id, 0);
        const result = this.actionExecutor.execute(action);
        console.log(`[Sink] ${result.message}`);

        if (result.success) {
          this.removeCaptainFromAction(ActionType.SINK);
          this.selectedAction = null;
          this.uiScene.clearActionSelection();
        }
        return;
      }
    }

    console.log('[Sink] No valid target');
  }

  /**
   * Execute Chart action
   */
  private executeChartAction(): void {
    const activePlayer = this.gameState.getActivePlayer()!;
    const action = ChartAction.createStandard(activePlayer.id);
    const result = this.actionExecutor.execute(action);
    console.log(`[Chart] ${result.message}`);

    if (result.success) {
      this.removeCaptainFromAction(ActionType.CHART);
      this.selectedAction = null;
      this.uiScene.clearActionSelection();
    }
  }

  update(time: number, delta: number): void {
    // Handle AI turns
    const activePlayer = this.gameState.getActivePlayer();
    if (activePlayer && activePlayer.isAI) {
      this.handleAITurn();
    }
  }

  /**
   * Handle AI player turn
   */
  private aiTurnDelay = 0;
  private handleAITurn(): void {
    // Add delay so AI moves aren't instant
    this.aiTurnDelay += this.game.loop.delta;
    if (this.aiTurnDelay < 1000) return; // 1 second delay
    this.aiTurnDelay = 0;

    const activePlayer = this.gameState.getActivePlayer();
    if (!activePlayer || !activePlayer.isAI) return;

    if (this.gameState.currentPhase === GamePhase.PLACE) {
      // AI places a random captain
      if (activePlayer.hasUnplacedCaptains()) {
        const actions = [ActionType.SAIL, ActionType.STEAL, ActionType.BUILD, ActionType.SINK, ActionType.CHART];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];

        if (activePlayer.placeCaptain(randomAction)) {
          console.log(`[AI] Placed captain on ${randomAction}`);
          this.gameState.forceUpdate();

          // Check if all players have placed all captains
          if (this.phaseManager.allCaptainsPlaced()) {
            console.log('[AI] All captains placed! Advancing to PLAY phase...');
            setTimeout(() => {
              this.phaseManager.advancePhase();
            }, 500); // Small delay for visual feedback
          } else {
            // Move to next player
            this.phaseManager.endTurn();
          }
        }
      }
    } else if (this.gameState.currentPhase === GamePhase.PLAY) {
      // AI play phase - remove a random captain and end turn
      console.log(`[AI] Starting turn with ${activePlayer.placedCaptains.length} captains:`, activePlayer.placedCaptains);

      if (activePlayer.placedCaptains.length > 0) {
        const randomIndex = Math.floor(Math.random() * activePlayer.placedCaptains.length);
        const removedAction = activePlayer.placedCaptains[randomIndex];

        // Remove the captain from the array
        activePlayer.placedCaptains.splice(randomIndex, 1);

        console.log(`[AI] Removed captain from ${removedAction}. Captains left: ${activePlayer.placedCaptains.length}`, activePlayer.placedCaptains);

        // Force UI update
        this.gameState.forceUpdate();
      } else {
        console.log('[AI] No captains left to use');
      }

      this.phaseManager.endTurn();
    }
  }
}
