import { PiratePower } from '../../../types/GameTypes';
import { BoardState } from '../../../game/types/GameState';
import { HexCoord } from '../../../types/CoordinateTypes';
import { BasePiratePower } from '../BasePiratePower';
import { registerPower } from '../PowerRegistry';
import { getHex } from '../../../game/logic/BoardLogic';

/**
 * The Islander
 * Can ignore impassable Island edges when sailing
 */
export class IslanderPower extends BasePiratePower {
  readonly id = PiratePower.THE_ISLANDER;
  readonly name = 'The Islander';
  readonly description = 'Can ignore impassable Island edges when sailing.';

  canSailBetween(
    board: BoardState,
    from: HexCoord,
    to: HexCoord,
    defaultCheck: () => boolean
  ): boolean {
    // The Islander ignores island edge restrictions
    // Just verify both hexes exist and are valid water/port hexes
    const fromHex = getHex(board, from);
    const toHex = getHex(board, to);

    if (!fromHex || !toHex) {
      return false;
    }

    // Can sail to any adjacent hex regardless of island edges
    return true;
  }
}

// Auto-register when module is imported
registerPower(new IslanderPower());
