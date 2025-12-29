import * as Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { ActionType, GamePhase } from '../types/GameTypes';

/**
 * UI overlay scene that displays player stats, actions, and game state
 */
export class UIScene extends Phaser.Scene {
  private gameState!: GameState;

  // UI elements
  private phaseText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private activePlayerText!: Phaser.GameObjects.Text;

  // Player stats
  private player1StatsText!: Phaser.GameObjects.Text;
  private player2StatsText!: Phaser.GameObjects.Text;

  // Action buttons
  private actionButtons: Map<ActionType, Phaser.GameObjects.Container>;
  private actionButtonBgs: Map<ActionType, Phaser.GameObjects.Graphics>;
  private captainSlots: Map<ActionType, Phaser.GameObjects.Container>;
  private endTurnButton!: Phaser.GameObjects.Container;
  private nextPhaseButton!: Phaser.GameObjects.Container;
  private selectedActionType: ActionType | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private captainCountText!: Phaser.GameObjects.Text;

  // Callback for action selection
  public onActionSelected?: (actionType: ActionType) => void;
  public onCaptainPlaced?: (actionType: ActionType) => void;
  public onEndTurn?: () => void;
  public onNextPhase?: () => void;

  constructor() {
    super({ key: 'UIScene' });
    this.actionButtons = new Map();
    this.actionButtonBgs = new Map();
    this.captainSlots = new Map();
  }

  init(data: { gameState: GameState }) {
    this.gameState = data.gameState;
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create background panels
    this.createBackgroundPanels(width, height);

    // Create phase and round indicators
    this.createPhaseIndicators();

    // Create player stats
    this.createPlayerStats();

    // Create action buttons
    this.createActionButtons();

    // Create control buttons
    this.createControlButtons();

    // Create status text (in top bar, right side)
    this.statusText = this.add.text(width - 20, 15, '', {
      fontSize: '16px',
      color: '#ffff00',
      fontStyle: 'bold',
      align: 'right'
    }).setOrigin(1, 0); // Right-aligned

    // Create captain count text
    this.captainCountText = this.add.text(width / 2, height - 10, '', {
      fontSize: '14px',
      color: '#aaaaff',
      align: 'center'
    }).setOrigin(0.5);

    // Subscribe to game state changes
    if (this.gameState) {
      this.gameState.addObserver(() => this.updateUI());
      this.updateUI();
    }
  }

  private createBackgroundPanels(width: number, height: number): void {
    // Top bar
    const topBar = this.add.graphics();
    topBar.fillStyle(0x0a0a1a, 0.9);
    topBar.fillRect(0, 0, width, 60);

    // Left sidebar
    const leftPanel = this.add.graphics();
    leftPanel.fillStyle(0x0a0a1a, 0.9);
    leftPanel.fillRect(0, 60, 250, height - 60);

    // Bottom bar
    const bottomBar = this.add.graphics();
    bottomBar.fillStyle(0x0a0a1a, 0.9);
    bottomBar.fillRect(0, height - 100, width, 100);
  }

  private createPhaseIndicators(): void {
    // Phase text
    this.phaseText = this.add.text(20, 15, 'Phase: SETUP', {
      fontSize: '20px',
      color: '#ffaa00',
      fontStyle: 'bold'
    });

    // Round text
    this.roundText = this.add.text(250, 15, 'Round: 1', {
      fontSize: '20px',
      color: '#ffffff'
    });

    // Active player text
    this.activePlayerText = this.add.text(400, 15, 'Turn: Player', {
      fontSize: '20px',
      color: '#00aaff'
    });
  }

  private createPlayerStats(): void {
    const startY = 80;

    // Player 1 title
    this.add.text(20, startY, 'Player (Blue)', {
      fontSize: '18px',
      color: '#00aaff',
      fontStyle: 'bold'
    });

    // Player 1 stats
    this.player1StatsText = this.add.text(20, startY + 30, '', {
      fontSize: '14px',
      color: '#ffffff'
    });

    // Player 2 title
    this.add.text(20, startY + 180, 'AI (Red)', {
      fontSize: '18px',
      color: '#ff3333',
      fontStyle: 'bold'
    });

    // Player 2 stats
    this.player2StatsText = this.add.text(20, startY + 210, '', {
      fontSize: '14px',
      color: '#ffffff'
    });

    // Instructions
    this.add.text(20, startY + 360, 'Click hex to select\nCheck console for info', {
      fontSize: '12px',
      color: '#888888',
      align: 'left'
    });
  }

  private createActionButtons(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const buttonY = height - 70;
    const slotY = height - 150; // Captain slots above buttons
    const startX = 280;
    const spacing = 140;

    const actions = [
      { type: ActionType.SAIL, label: 'Sail', color: 0x4488ff },
      { type: ActionType.STEAL, label: 'Steal', color: 0xff8844 },
      { type: ActionType.BUILD, label: 'Build', color: 0x44ff88 },
      { type: ActionType.SINK, label: 'Sink', color: 0xff4444 },
      { type: ActionType.CHART, label: 'Chart', color: 0xffaa44 }
    ];

    actions.forEach((action, index) => {
      const x = startX + (index * spacing);

      // Create captain slot above button
      const slot = this.createCaptainSlot(x, slotY);
      this.captainSlots.set(action.type, slot);

      const { container, bg } = this.createButton(x, buttonY, action.label, action.color, () => {
        if (this.gameState.currentPhase === GamePhase.PLACE) {
          // PLACE phase: place a captain on this action
          if (this.onCaptainPlaced) {
            this.onCaptainPlaced(action.type);
          }
        } else if (this.gameState.currentPhase === GamePhase.PLAY) {
          // PLAY phase: select this action for execution
          this.selectedActionType = action.type;
          this.updateActionButtonStates();
          this.updateStatusText(`${action.label} selected - Click target hex`);

          if (this.onActionSelected) {
            this.onActionSelected(action.type);
          }
        }
      });
      this.actionButtons.set(action.type, container);
      this.actionButtonBgs.set(action.type, bg);
    });
  }

  /**
   * Create a visual slot for captain placement
   */
  private createCaptainSlot(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Slot background (small rectangle)
    const bg = this.add.graphics();
    bg.fillStyle(0x333344, 0.8);
    bg.fillRoundedRect(0, 0, 120, 60, 8);
    bg.lineStyle(2, 0x555577, 1.0);
    bg.strokeRoundedRect(0, 0, 120, 60, 8);

    container.add(bg);
    return container;
  }

  /**
   * Update captain slot visuals to show placed captains
   */
  private updateCaptainSlots(): void {
    if (!this.gameState) return;

    // Debug: log all player captains
    console.log('[UIScene] Updating captain slots. Player captains:',
      this.gameState.players.map(p => ({ name: p.name, captains: p.placedCaptains })));

    for (const [actionType, slot] of this.captainSlots.entries()) {
      // Clear existing captain tokens
      slot.removeAll(true);

      // Count how many captains each player has on this action
      const captainCounts: Array<{ player: any; count: number }> = [];
      for (const player of this.gameState.players) {
        const count = player.placedCaptains.filter(a => a === actionType).length;
        if (count > 0) {
          captainCounts.push({ player, count });
        }
      }

      const totalCaptains = captainCounts.reduce((sum, pc) => sum + pc.count, 0);

      // Debug: log captain placements
      if (totalCaptains > 0) {
        console.log(`[UIScene] ${actionType}: ${totalCaptains} total captain(s) placed`);
      }

      // Redraw slot background
      const bg = this.add.graphics();
      const hasCaptains = totalCaptains > 0;

      if (hasCaptains) {
        bg.fillStyle(0x4444aa, 1.0);
      } else {
        bg.fillStyle(0x333344, 0.8);
      }
      bg.fillRoundedRect(0, 0, 120, 60, 8);
      bg.lineStyle(2, hasCaptains ? 0xffffaa : 0x555577, 1.0);
      bg.strokeRoundedRect(0, 0, 120, 60, 8);
      slot.add(bg);

      // Draw captain tokens if present
      if (hasCaptains) {
        let tokenIndex = 0;
        for (const { player, count } of captainCounts) {
          for (let i = 0; i < count; i++) {
            const xOffset = 20 + (tokenIndex * 25); // Space them out horizontally
            const token = this.add.circle(xOffset, 30, 12, player.isAI ? 0xff3333 : 0x00aaff);
            const text = this.add.text(xOffset, 30, 'C', {
              fontSize: '12px',
              color: '#ffffff',
              fontStyle: 'bold'
            }).setOrigin(0.5);
            slot.add([token, text]);
            tokenIndex++;
          }
        }
      }
    }
  }

  private createControlButtons(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // End Turn button
    this.endTurnButton = this.createButton(width - 140, height - 70, 'End Turn', 0x00aa00, () => {
      this.selectedActionType = null;
      this.updateActionButtonStates();
      this.updateStatusText('');
      if (this.onEndTurn) {
        this.onEndTurn();
      }
    }).container;

    // Next Phase button (for testing)
    this.nextPhaseButton = this.createButton(width - 140, height - 135, 'Next Phase', 0xaa00aa, () => {
      this.selectedActionType = null;
      this.updateActionButtonStates();
      this.updateStatusText('');
      if (this.onNextPhase) {
        this.onNextPhase();
      }
    }).container;
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void
  ): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics } {
    const container = this.add.container(x, y);

    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(color, 1.0);
    bg.fillRoundedRect(0, 0, 120, 50, 8);
    bg.lineStyle(2, 0xffffff, 0.8);
    bg.strokeRoundedRect(0, 0, 120, 50, 8);

    // Button text
    const text = this.add.text(60, 25, label, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(120, 50);
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 120, 50),
      Phaser.Geom.Rectangle.Contains
    );

    // Hover effect
    container.on('pointerover', () => {
      container.setScale(1.05);
    });
    container.on('pointerout', () => {
      container.setScale(1.0);
    });

    // Click handler
    container.on('pointerdown', onClick);

    return { container, bg };
  }

  /**
   * Update action button visual states based on selection
   */
  private updateActionButtonStates(): void {
    for (const [actionType, bg] of this.actionButtonBgs.entries()) {
      bg.clear();

      const isSelected = actionType === this.selectedActionType;
      const color = this.getActionColor(actionType);

      // Draw background
      bg.fillStyle(color, 1.0);
      bg.fillRoundedRect(0, 0, 120, 50, 8);

      // Draw border - thicker and brighter if selected
      if (isSelected) {
        bg.lineStyle(5, 0xffff00, 1.0);
      } else {
        bg.lineStyle(2, 0xffffff, 0.8);
      }
      bg.strokeRoundedRect(0, 0, 120, 50, 8);
    }
  }

  /**
   * Get the color for an action type
   */
  private getActionColor(actionType: ActionType): number {
    const colorMap: { [key in ActionType]: number } = {
      [ActionType.SAIL]: 0x4488ff,
      [ActionType.STEAL]: 0xff8844,
      [ActionType.BUILD]: 0x44ff88,
      [ActionType.SINK]: 0xff4444,
      [ActionType.CHART]: 0xffaa44
    };
    return colorMap[actionType] || 0x888888;
  }

  /**
   * Update status text
   */
  private updateStatusText(text: string): void {
    this.statusText.setText(text);
  }

  /**
   * Clear action selection (called from GameScene after action execution)
   */
  public clearActionSelection(): void {
    this.selectedActionType = null;
    this.updateActionButtonStates();
    this.updateStatusText('');
  }

  private updateUI(): void {
    if (!this.gameState) return;

    // Update captain slots
    this.updateCaptainSlots();

    // Update phase indicator
    this.phaseText.setText(`Phase: ${this.gameState.currentPhase}`);
    this.phaseText.setColor(this.getPhaseColor(this.gameState.currentPhase));

    // Update round
    this.roundText.setText(`Round: ${this.gameState.currentRound}`);

    // Update active player
    const activePlayer = this.gameState.getActivePlayer();
    if (activePlayer) {
      this.activePlayerText.setText(`Turn: ${activePlayer.name}`);
      this.activePlayerText.setColor(activePlayer.isAI ? '#ff3333' : '#00aaff');
    }

    // Update player stats
    if (this.gameState.players.length >= 2) {
      const p1 = this.gameState.players[0];
      const p2 = this.gameState.players[1];

      this.player1StatsText.setText(
        `Notoriety: ${p1.notoriety}\n` +
        `Doubloons: ${p1.doubloons}\n` +
        `Captains: ${p1.captainCount}\n` +
        `Sloops: ${p1.ships.sloops}\n` +
        `Galleons: ${p1.ships.galleons}\n` +
        `Score: ${p1.getFinalScore()}`
      );

      this.player2StatsText.setText(
        `Notoriety: ${p2.notoriety}\n` +
        `Doubloons: ${p2.doubloons}\n` +
        `Captains: ${p2.captainCount}\n` +
        `Sloops: ${p2.ships.sloops}\n` +
        `Galleons: ${p2.ships.galleons}\n` +
        `Score: ${p2.getFinalScore()}`
      );
    }

    // Update captain count text and status during PLACE phase
    if (this.gameState.currentPhase === GamePhase.PLACE && activePlayer) {
      const placed = activePlayer.placedCaptains.length;
      const total = activePlayer.captainCount;
      this.captainCountText.setText(`Captains placed: ${placed}/${total}`);

      if (activePlayer.isAI) {
        this.updateStatusText('AI is placing captain...');
      } else if (activePlayer.hasUnplacedCaptains()) {
        this.updateStatusText('Click an action to place your captain');
      }
    } else if (this.gameState.currentPhase === GamePhase.PLAY) {
      this.captainCountText.setText('');
      // Status text is managed by action selection during PLAY phase
      if (!this.selectedActionType) {
        if (activePlayer && activePlayer.isAI) {
          this.updateStatusText('AI is thinking...');
        } else {
          this.updateStatusText('');
        }
      }
    } else {
      this.captainCountText.setText('');
      this.updateStatusText('');
    }

    // Enable/disable action buttons based on phase and captain placement
    const isPlacePhase = this.gameState.currentPhase === GamePhase.PLACE;
    const isPlayPhase = this.gameState.currentPhase === GamePhase.PLAY;
    const isPlayerTurn = activePlayer && !activePlayer.isAI;

    for (const [actionType, button] of this.actionButtons.entries()) {
      let canInteract = false;
      let alpha = 0.5;

      if (isPlacePhase && isPlayerTurn && activePlayer.hasUnplacedCaptains()) {
        // During PLACE phase: can click if player has captains left
        canInteract = true;
        alpha = 1.0;
      } else if (isPlayPhase && isPlayerTurn) {
        // During PLAY phase: can only click if captain is placed on this action
        const hasCaptain = activePlayer.placedCaptains.includes(actionType);
        canInteract = hasCaptain;
        alpha = hasCaptain ? 1.0 : 0.3;
      }

      button.setAlpha(alpha);
      if (canInteract) {
        button.setInteractive();
      } else {
        button.removeInteractive();
      }
    }
  }

  private getPhaseColor(phase: GamePhase): string {
    switch (phase) {
      case GamePhase.SETUP: return '#888888';
      case GamePhase.PLACE: return '#ffaa00';
      case GamePhase.PLAY: return '#00ff00';
      case GamePhase.PIRATE: return '#aa00ff';
      case GamePhase.GAME_OVER: return '#ff0000';
      default: return '#ffffff';
    }
  }
}
