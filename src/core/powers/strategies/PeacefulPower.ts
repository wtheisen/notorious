import { PiratePower, ShipType } from '../../../types/GameTypes';
import { PlayerState } from '../../../game/types/GameState';
import { BasePiratePower } from '../BasePiratePower';
import { registerPower } from '../PowerRegistry';
import { gainDoubloons } from '../../../game/logic/PlayerLogic';

/**
 * The Peaceful
 * Can't take Sink actions
 * Gains 1 doubloon when their ship is sunk or stolen
 */
export class PeacefulPower extends BasePiratePower {
  readonly id = PiratePower.THE_PEACEFUL;
  readonly name = 'The Peaceful';
  readonly description = "Can't take Sink actions. Gains 1 doubloon when their ship is sunk.";
  readonly bounty = 750;  // From rulebook

  canUseSink(): boolean {
    return false;
  }

  onShipSunk(player: PlayerState, shipType: ShipType, attacker: PlayerState): void {
    gainDoubloons(player, 1);
    console.log(`[PeacefulPower] ${player.name} gained 1 doubloon for ship being sunk`);
  }

  onShipStolen(player: PlayerState, attacker: PlayerState): void {
    gainDoubloons(player, 1);
    console.log(`[PeacefulPower] ${player.name} gained 1 doubloon for ship being stolen`);
  }
}

// Auto-register when module is imported
registerPower(new PeacefulPower());
