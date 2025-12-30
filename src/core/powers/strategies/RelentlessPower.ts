import { PiratePower } from '../../../types/GameTypes';
import { BasePiratePower } from '../BasePiratePower';
import { registerPower } from '../PowerRegistry';

/**
 * The Relentless
 * Can move a Sloop one Hex before they use their Sink action (free bribe)
 * Doesn't gain Notoriety for controlling Hexes
 */
export class RelentlessPower extends BasePiratePower {
  readonly id = PiratePower.THE_RELENTLESS;
  readonly name = 'The Relentless';
  readonly description = "Can move a Sloop one Hex before Sink action. Doesn't gain Notoriety for controlling Hexes.";
  readonly bounty = 400;

  modifySinkCost(baseCost: number, options: { movingSloop: boolean }): number {
    // First sloop move is free when doing a sink action
    if (options.movingSloop && baseCost > 0) {
      return baseCost - 1;
    }
    return baseCost;
  }

  modifyHexControlNotoriety(baseNotoriety: number): number {
    // The Relentless doesn't gain notoriety from hex control
    return 0;
  }
}

// Auto-register when module is imported
registerPower(new RelentlessPower());
