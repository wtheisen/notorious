import { PiratePower, ShipType, ActionType } from '../../types/GameTypes';
import { BoardState, PlayerState } from '../../game/types/GameState';
import { HexCoord } from '../../types/CoordinateTypes';

/**
 * Strategy interface for pirate powers
 * Each power implements this interface, overriding only the methods it needs
 */
export interface PiratePowerStrategy {
  /** Unique identifier for this power */
  readonly id: PiratePower;
  /** Display name */
  readonly name: string;
  /** Description shown in UI */
  readonly description: string;
  /** Bounty value for tiebreaking (0-1000 doubloons, increments of 25) */
  readonly bounty: number;

  // === SAIL ACTION ===
  /** Max hexes a ship can move (default: 2) */
  getSailMaxDistance(): number;
  /**
   * Override sailing rules (e.g., ignore island edges)
   * @param defaultCheck - Function that performs the standard canSailBetween check
   */
  canSailBetween(
    board: BoardState,
    from: HexCoord,
    to: HexCoord,
    defaultCheck: () => boolean
  ): boolean;

  // === ACTION AVAILABILITY ===
  /** Can this player use the SINK action? */
  canUseSink(): boolean;
  /** Can this player use the STEAL action? */
  canUseSteal(): boolean;
  /** Can this player use the BUILD action? */
  canUseBuild(): boolean;
  /** Can this player use the CHART action? */
  canUseChart(): boolean;

  // === COST MODIFIERS ===
  /**
   * Modify bribe costs for SINK action
   * @param baseCost - The doubloons the player is trying to spend
   * @param options - Context about the action
   * @returns The actual cost to charge
   */
  modifySinkCost(baseCost: number, options: { movingSloop: boolean }): number;
  /** Modify bribe costs for BUILD action */
  modifyBuildCost(baseCost: number): number;

  // === PASSIVE TRIGGERS (called on the victim's strategy) ===
  /**
   * Called when this player's ship is sunk
   * Use this to grant compensation (e.g., doubloons)
   */
  onShipSunk(player: PlayerState, shipType: ShipType, attacker: PlayerState): void;
  /**
   * Called when this player's ship is stolen
   * Use this to grant compensation
   */
  onShipStolen(player: PlayerState, attacker: PlayerState): void;

  // === REWARD MODIFIERS ===
  /** Modify notoriety gained from hex control in Pirate phase */
  modifyHexControlNotoriety(baseNotoriety: number): number;
  /** Modify notoriety gained from sinking ships */
  modifySinkNotoriety(baseNotoriety: number, targetShipType: ShipType): number;
  /** Modify doubloon rewards from any source */
  modifyDoubloonReward(baseAmount: number, source: string): number;

  // === OPTIONAL LIFECYCLE HOOKS ===
  /** Called at the start of this player's turn */
  onTurnStart?(player: PlayerState): void;
  /** Called at the end of this player's turn */
  onTurnEnd?(player: PlayerState): void;
  /** Modify which actions are available during PLACE phase */
  modifyAvailableActions?(baseActions: ActionType[]): ActionType[];
}
