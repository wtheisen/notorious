import { PiratePower, ShipType, ActionType } from '../../types/GameTypes';
import { BoardState, PlayerState } from '../../game/types/GameState';
import { HexCoord } from '../../types/CoordinateTypes';
import { PiratePowerStrategy } from './PiratePowerStrategy';

/**
 * Abstract base class for pirate powers
 * Provides default implementations for all methods
 * Subclasses only need to override what they change
 */
export abstract class BasePiratePower implements PiratePowerStrategy {
  abstract readonly id: PiratePower;
  abstract readonly name: string;
  abstract readonly description: string;

  // === SAIL ACTION (defaults) ===
  getSailMaxDistance(): number {
    return 2;
  }

  canSailBetween(
    board: BoardState,
    from: HexCoord,
    to: HexCoord,
    defaultCheck: () => boolean
  ): boolean {
    return defaultCheck();
  }

  // === ACTION AVAILABILITY (defaults: all allowed) ===
  canUseSink(): boolean {
    return true;
  }

  canUseSteal(): boolean {
    return true;
  }

  canUseBuild(): boolean {
    return true;
  }

  canUseChart(): boolean {
    return true;
  }

  // === COST MODIFIERS (defaults: no modification) ===
  modifySinkCost(baseCost: number, options: { movingSloop: boolean }): number {
    return baseCost;
  }

  modifyBuildCost(baseCost: number): number {
    return baseCost;
  }

  // === PASSIVE TRIGGERS (defaults: no effect) ===
  onShipSunk(player: PlayerState, shipType: ShipType, attacker: PlayerState): void {
    // No effect by default
  }

  onShipStolen(player: PlayerState, attacker: PlayerState): void {
    // No effect by default
  }

  // === REWARD MODIFIERS (defaults: no modification) ===
  modifyHexControlNotoriety(baseNotoriety: number): number {
    return baseNotoriety;
  }

  modifySinkNotoriety(baseNotoriety: number, targetShipType: ShipType): number {
    return baseNotoriety;
  }

  modifyDoubloonReward(baseAmount: number, source: string): number {
    return baseAmount;
  }

  // === OPTIONAL LIFECYCLE HOOKS (not implemented by default) ===
  // Subclasses can override these if needed
}
