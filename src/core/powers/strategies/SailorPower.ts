import { PiratePower } from '../../../types/GameTypes';
import { BasePiratePower } from '../BasePiratePower';
import { registerPower } from '../PowerRegistry';

/**
 * The Sailor
 * Can move ships 3 hexes instead of 2 during Sail action
 */
export class SailorPower extends BasePiratePower {
  readonly id = PiratePower.THE_SAILOR;
  readonly name = 'The Sailor';
  readonly description = 'Can move ships 3 hexes instead of 2 during Sail action.';
  readonly bounty = 500;

  getSailMaxDistance(): number {
    return 3;
  }
}

// Auto-register when module is imported
registerPower(new SailorPower());
