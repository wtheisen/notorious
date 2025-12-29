import { PlayerColor, ActionType, ShipInventory, GAME_CONSTANTS } from '../types/GameTypes';
import { HexCoord } from '../types/CoordinateTypes';

/**
 * Represents a player in the game
 */
export class Player {
  public readonly id: string;
  public readonly name: string;
  public readonly color: PlayerColor;
  public readonly isAI: boolean;

  public notoriety: number;
  public doubloons: number;
  public captainCount: number;
  public ships: ShipInventory;
  public portLocation: HexCoord | null;

  // Captain placements during PLACE phase
  public placedCaptains: ActionType[];

  // Pirate ability (simplified for MVP - just a name for now)
  public pirateName: string;

  constructor(
    id: string,
    name: string,
    color: PlayerColor,
    isAI: boolean = false,
    pirateName: string = 'Generic Pirate'
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.isAI = isAI;
    this.pirateName = pirateName;

    // Initialize starting resources
    this.notoriety = 0;
    this.doubloons = GAME_CONSTANTS.STARTING_DOUBLOONS;
    this.captainCount = GAME_CONSTANTS.STARTING_CAPTAINS;
    this.ships = {
      sloops: GAME_CONSTANTS.STARTING_SLOOPS,
      galleons: GAME_CONSTANTS.STARTING_GALLEONS
    };
    this.portLocation = null;
    this.placedCaptains = [];
  }

  /**
   * Place a captain on an action during PLACE phase
   */
  placeCaptain(action: ActionType): boolean {
    if (this.placedCaptains.length >= this.captainCount) {
      console.log(`[Player] ${this.name} cannot place captain - already placed ${this.placedCaptains.length}/${this.captainCount}`);
      return false; // Already placed all captains
    }

    this.placedCaptains.push(action);
    console.log(`[Player] ${this.name} placed captain on ${action}. Total: ${this.placedCaptains.length}/${this.captainCount}`, this.placedCaptains);
    return true;
  }

  /**
   * Remove a captain from an action during PLAY phase
   * Returns the action type if successful, null otherwise
   */
  removeCaptain(): ActionType | null {
    if (this.placedCaptains.length === 0) {
      return null;
    }
    return this.placedCaptains.pop()!;
  }

  /**
   * Check if player has captains left to place
   */
  hasUnplacedCaptains(): boolean {
    return this.placedCaptains.length < this.captainCount;
  }

  /**
   * Reset captain placements for a new round
   */
  resetCaptains(): void {
    this.placedCaptains = [];
  }

  /**
   * Gain notoriety points
   */
  gainNotoriety(amount: number): void {
    const oldNotoriety = this.notoriety;
    this.notoriety += amount;

    // Check for captain unlocks
    GAME_CONSTANTS.CAPTAIN_UNLOCK_THRESHOLDS.forEach(threshold => {
      if (oldNotoriety < threshold && this.notoriety >= threshold) {
        this.captainCount++;
      }
    });
  }

  /**
   * Gain doubloons
   */
  gainDoubloons(amount: number): void {
    this.doubloons += amount;
  }

  /**
   * Spend doubloons (e.g., for bribes)
   * Returns true if successful, false if not enough doubloons
   */
  spendDoubloons(amount: number): boolean {
    if (this.doubloons < amount) {
      return false;
    }
    this.doubloons -= amount;
    return true;
  }

  /**
   * Check if player has enough ships of a type
   */
  hasShips(type: 'sloops' | 'galleons', count: number): boolean {
    return this.ships[type] >= count;
  }

  /**
   * Spend ships (when placing them on the board)
   */
  spendShips(type: 'sloops' | 'galleons', count: number): boolean {
    if (!this.hasShips(type, count)) {
      return false;
    }
    this.ships[type] -= count;
    return true;
  }

  /**
   * Return ships to inventory (when they're removed from the board)
   */
  returnShips(type: 'sloops' | 'galleons', count: number): void {
    this.ships[type] += count;
  }

  /**
   * Check if player has won
   */
  hasWon(): boolean {
    return this.notoriety >= GAME_CONSTANTS.WINNING_NOTORIETY;
  }

  /**
   * Get final score (notoriety + doubloons)
   */
  getFinalScore(): number {
    return this.notoriety + this.doubloons;
  }

  /**
   * Set port location
   */
  setPortLocation(coord: HexCoord): void {
    this.portLocation = coord;
  }
}
