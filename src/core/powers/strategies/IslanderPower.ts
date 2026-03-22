import { PiratePower } from '../../../types/GameTypes';
import { BoardState } from '../../../game/types/GameState';
import { HexCoord } from '../../../types/CoordinateTypes';
import { BasePiratePower } from '../BasePiratePower';
import { registerPower } from '../PowerRegistry';
import { getHex, isAdjacent } from '../../../game/logic/BoardLogic';

/**
 * The Islander
 * Can ignore impassable Island edges when sailing
 */
export class IslanderPower extends BasePiratePower {
  readonly id = PiratePower.THE_ISLANDER;
  readonly name = 'The Islander';
  readonly description = 'Can ignore impassable Island edges when sailing.';
  readonly bounty = 550;

  canSailBetween(
    board: BoardState,
    from: HexCoord,
    to: HexCoord,
    defaultCheck: () => boolean
  ): boolean {
    // Must be adjacent (including wrapping), but ignore island edge restrictions
    if (!isAdjacent(from, to)) return false;

    const fromHex = getHex(board, from);
    const toHex = getHex(board, to);
    return !!(fromHex && toHex);
  }
}

// Auto-register when module is imported
registerPower(new IslanderPower());
