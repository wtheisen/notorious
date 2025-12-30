import { GamePhase, WindDirection, StateChangeCallback, GAME_CONSTANTS } from '../types/GameTypes';
import { Player } from './Player';
import { Board } from './Board';
import { ChartDeck } from './ChartDeck';

/**
 * Central game state manager with observer pattern
 * Single source of truth for all game state
 */
export class GameState {
  public players: Player[];
  public board: Board;
  public currentPhase: GamePhase;
  public currentRound: number;
  public activePlayerIndex: number;
  public windDirection: WindDirection;
  public gameOver: boolean;
  public winner: Player | null;

  // Chart deck and wind token
  public chartDeck: ChartDeck;
  public windTokenHolder: string | null; // Player ID who has wind token

  private observers: StateChangeCallback[];

  constructor() {
    this.players = [];
    this.board = new Board();
    this.currentPhase = GamePhase.SETUP;
    this.currentRound = 0;
    this.activePlayerIndex = 0;
    this.windDirection = WindDirection.CLOCKWISE;
    this.gameOver = false;
    this.winner = null;
    this.chartDeck = new ChartDeck();
    this.windTokenHolder = null;
    this.observers = [];
  }

  /**
   * Initialize the game with players
   */
  initialize(players: Player[]): void {
    this.players = players;
    this.board = new Board();
    this.currentPhase = GamePhase.SETUP;
    this.currentRound = 1;
    this.activePlayerIndex = 0;
    this.windDirection = WindDirection.CLOCKWISE;
    this.gameOver = false;
    this.winner = null;

    this.notifyObservers();
  }

  /**
   * Add an observer to be notified of state changes
   */
  addObserver(callback: StateChangeCallback): void {
    this.observers.push(callback);
  }

  /**
   * Remove an observer
   */
  removeObserver(callback: StateChangeCallback): void {
    const index = this.observers.indexOf(callback);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }

  /**
   * Notify all observers of state change
   */
  private notifyObservers(): void {
    for (const observer of this.observers) {
      observer();
    }
  }

  /**
   * Get the currently active player
   */
  getActivePlayer(): Player | null {
    return this.players[this.activePlayerIndex] || null;
  }

  /**
   * Move to the next player's turn
   */
  nextTurn(): void {
    if (this.windDirection === WindDirection.CLOCKWISE) {
      this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    } else {
      this.activePlayerIndex = (this.activePlayerIndex - 1 + this.players.length) % this.players.length;
    }

    this.notifyObservers();
  }

  /**
   * Move to the next phase
   */
  nextPhase(): void {
    switch (this.currentPhase) {
      case GamePhase.SETUP:
        this.currentPhase = GamePhase.PLACE;
        break;
      case GamePhase.PLACE:
        this.currentPhase = GamePhase.PLAY;
        break;
      case GamePhase.PLAY:
        this.currentPhase = GamePhase.PIRATE;
        break;
      case GamePhase.PIRATE:
        // Check for game end
        if (this.checkGameEnd()) {
          this.currentPhase = GamePhase.GAME_OVER;
        } else {
          this.currentPhase = GamePhase.PLACE;
          this.currentRound++;
          this.resetPlayersForNewRound();
        }
        break;
      case GamePhase.GAME_OVER:
        // Game is over, no phase change
        break;
    }

    this.notifyObservers();
  }

  /**
   * Reset players for a new round
   */
  private resetPlayersForNewRound(): void {
    for (const player of this.players) {
      player.resetCaptains();
    }
  }

  /**
   * Check if the game should end
   * Game ends when any player reaches winning notoriety
   */
  checkGameEnd(): boolean {
    for (const player of this.players) {
      if (player.hasWon()) {
        this.gameOver = true;
        this.determineWinner();
        return true;
      }
    }
    return false;
  }

  /**
   * Determine the winner based on final scores
   */
  private determineWinner(): void {
    let highestScore = -1;
    let winner: Player | null = null;

    for (const player of this.players) {
      const score = player.getFinalScore();
      if (score > highestScore) {
        highestScore = score;
        winner = player;
      }
    }

    this.winner = winner;
    this.notifyObservers();
  }

  /**
   * Change wind direction
   */
  changeWindDirection(direction: WindDirection): void {
    this.windDirection = direction;
    this.notifyObservers();
  }

  /**
   * Toggle wind direction
   */
  toggleWindDirection(): void {
    this.windDirection = this.windDirection === WindDirection.CLOCKWISE
      ? WindDirection.COUNTERCLOCKWISE
      : WindDirection.CLOCKWISE;
    this.notifyObservers();
  }

  /**
   * Award notoriety to a player
   */
  awardNotoriety(playerId: string, amount: number): void {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.gainNotoriety(amount);
      this.notifyObservers();
    }
  }

  /**
   * Award doubloons to a player
   */
  awardDoubloons(playerId: string, amount: number): void {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.gainDoubloons(amount);
      this.notifyObservers();
    }
  }

  /**
   * Get a player by ID
   */
  getPlayer(playerId: string): Player | null {
    return this.players.find(p => p.id === playerId) || null;
  }

  /**
   * Get all players except the specified one
   */
  getOpponents(playerId: string): Player[] {
    return this.players.filter(p => p.id !== playerId);
  }

  /**
   * Force a state update notification
   */
  forceUpdate(): void {
    this.notifyObservers();
  }

  /**
   * Give the wind token to a player
   */
  giveWindToken(playerId: string): void {
    this.windTokenHolder = playerId;
    const player = this.getPlayer(playerId);
    console.log(`[GameState] ${player?.name || playerId} received the Wind token`);
  }

  /**
   * Check if a player has the wind token
   */
  hasWindToken(playerId: string): boolean {
    return this.windTokenHolder === playerId;
  }

  /**
   * Remove the wind token from current holder
   */
  removeWindToken(): void {
    this.windTokenHolder = null;
  }
}
