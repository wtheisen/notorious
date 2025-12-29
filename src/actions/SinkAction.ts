import { BaseAction } from './Action';
import { ActionType, ActionResult, ValidationResult, ShipType } from '../types/GameTypes';
import { GameState } from '../core/GameState';
import { HexCoord } from '../types/CoordinateTypes';
import { Ship } from '../core/Ship';

/**
 * Sink Action: Remove an opponent's Ship in a Hex with at least one of your pieces.
 * If you are removing a Galleon you must have at least as much Influence in the Hex
 * as the Galleon's owner. If the opponent is at least as Notorious as you are and
 * you sink one of their Sloops, gain a Notoriety. If you sink one of their Galleons,
 * gain three Notoriety.
 *
 * Bribe 1: Move a Sloop one Hex prior to Sinking.
 * Bribe 2: Sink another Ship in the same Hex.
 */
export class SinkAction extends BaseAction {
  private targetHex: HexCoord;
  private targetShip: ShipType;
  private targetPlayerId: string;
  private moveSloop?: { from: HexCoord; to: HexCoord };
  private additionalSink?: { ship: ShipType; playerId: string };

  constructor(
    playerId: string,
    targetHex: HexCoord,
    targetShip: ShipType,
    targetPlayerId: string,
    bribesUsed: number = 0,
    moveSloop?: { from: HexCoord; to: HexCoord },
    additionalSink?: { ship: ShipType; playerId: string }
  ) {
    super(ActionType.SINK, playerId, bribesUsed);
    this.targetHex = targetHex;
    this.targetShip = targetShip;
    this.targetPlayerId = targetPlayerId;
    this.moveSloop = moveSloop;
    this.additionalSink = additionalSink;
  }

  validate(gameState: GameState): ValidationResult {
    const playerCheck = this.validatePlayer(gameState);
    if (!playerCheck.valid) return playerCheck;

    const player = this.getPlayer(gameState)!;
    const board = gameState.board;

    // Check player has enough doubloons for bribes
    if (this.bribesUsed > player.doubloons) {
      return { valid: false, reason: 'Not enough doubloons for bribes' };
    }

    // Validate sloop movement if applicable (bribe 1)
    if (this.moveSloop) {
      const fromHex = board.getHex(this.moveSloop.from);
      const toHex = board.getHex(this.moveSloop.to);

      if (!fromHex || !toHex) {
        return { valid: false, reason: 'Invalid sloop movement hexes' };
      }

      if (!board.canSailBetween(this.moveSloop.from, this.moveSloop.to)) {
        return { valid: false, reason: 'Cannot move sloop along this path' };
      }

      const hasSloop = fromHex.getPlayerShips(this.playerId).some(s => s.type === ShipType.SLOOP);
      if (!hasSloop) {
        return { valid: false, reason: 'No sloop to move' };
      }
    }

    const hex = board.getHex(this.targetHex);
    if (!hex) {
      return { valid: false, reason: 'Invalid hex coordinate' };
    }

    // Check player has at least one piece in this hex
    const playerShips = hex.getPlayerShips(this.playerId);
    if (playerShips.length === 0) {
      return { valid: false, reason: 'You have no pieces in this hex' };
    }

    // Check target has the ship to sink
    const targetShips = hex.getPlayerShips(this.targetPlayerId);
    const hasShip = targetShips.some(s => s.type === this.targetShip);
    if (!hasShip) {
      return { valid: false, reason: 'Target ship not found in hex' };
    }

    // If sinking a Galleon, check influence requirement
    if (this.targetShip === ShipType.GALLEON) {
      const playerInfluence = hex.getInfluence(this.playerId);
      const targetInfluence = hex.getInfluence(this.targetPlayerId);
      if (playerInfluence < targetInfluence) {
        return { valid: false, reason: 'Not enough influence to sink Galleon' };
      }
    }

    return { valid: true };
  }

  execute(gameState: GameState): ActionResult {
    const validation = this.validate(gameState);
    if (!validation.valid) {
      return this.createFailureResult(validation.reason || 'Invalid action');
    }

    const player = this.getPlayer(gameState)!;
    const target = gameState.getPlayer(this.targetPlayerId);
    const board = gameState.board;

    // Spend doubloons for bribes
    if (this.bribesUsed > 0) {
      player.spendDoubloons(this.bribesUsed);
    }

    // Move sloop if applicable (bribe 1)
    if (this.moveSloop) {
      const fromHex = board.getHex(this.moveSloop.from)!;
      const sloop = fromHex.getPlayerShips(this.playerId).find(s => s.type === ShipType.SLOOP)!;
      board.moveShip(this.moveSloop.from, this.moveSloop.to, sloop);
    }

    // Sink the target ship
    let notorietyGained = 0;
    const hex = board.getHex(this.targetHex)!;
    const targetShips = hex.getPlayerShips(this.targetPlayerId);
    const shipToSink = targetShips.find(s => s.type === this.targetShip)!;

    hex.removeShip(shipToSink);

    // Return ship to opponent's inventory
    if (target) {
      if (this.targetShip === ShipType.SLOOP) {
        target.returnShips('sloops', 1);
      } else if (this.targetShip === ShipType.GALLEON) {
        target.returnShips('galleons', 1);
      }
    }

    // Calculate notoriety gain
    if (target && target.notoriety >= player.notoriety) {
      if (this.targetShip === ShipType.SLOOP) {
        notorietyGained = 1;
      } else if (this.targetShip === ShipType.GALLEON) {
        notorietyGained = 3;
      }
      player.gainNotoriety(notorietyGained);
    }

    // Sink additional ship if applicable (bribe 2)
    if (this.additionalSink) {
      const additionalShips = hex.getPlayerShips(this.additionalSink.playerId);
      const additionalShip = additionalShips.find(s => s.type === this.additionalSink!.ship);
      if (additionalShip) {
        hex.removeShip(additionalShip);
        const additionalTarget = gameState.getPlayer(this.additionalSink.playerId);
        if (additionalTarget) {
          if (this.additionalSink.ship === ShipType.SLOOP) {
            additionalTarget.returnShips('sloops', 1);
          } else if (this.additionalSink.ship === ShipType.GALLEON) {
            additionalTarget.returnShips('galleons', 1);
          }
        }
      }
    }

    gameState.forceUpdate();

    return this.createSuccessResult(
      `Sunk ${this.targetShip}${notorietyGained > 0 ? ` (+${notorietyGained} notoriety)` : ''}`,
      notorietyGained
    );
  }

  describe(): string {
    return `Sink: Remove ${this.targetShip}`;
  }
}
