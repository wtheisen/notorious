import { BaseAction } from './Action';
import { ActionType, ActionResult, ValidationResult, ShipType } from '../types/GameTypes';
import { GameState } from '../core/GameState';
import { HexCoord } from '../types/CoordinateTypes';
import { Ship } from '../core/Ship';

/**
 * Build Action: Place two Sloops or a Galleon in a Hex
 * with at least one of your pieces and no enemy pieces or in the Hex with your Port.
 *
 * Bribe: Place a Sloop in the same Hex.
 */
export class BuildAction extends BaseAction {
  private placements: Array<{ hex: HexCoord; shipType: ShipType }>;

  constructor(
    playerId: string,
    placements: Array<{ hex: HexCoord; shipType: ShipType }>,
    bribesUsed: number = 0
  ) {
    super(ActionType.BUILD, playerId, bribesUsed);
    this.placements = placements;
  }

  validate(gameState: GameState): ValidationResult {
    // Check player exists
    const playerCheck = this.validatePlayer(gameState);
    if (!playerCheck.valid) return playerCheck;

    const player = this.getPlayer(gameState)!;
    const board = gameState.board;

    // Check player has enough doubloons for bribes
    if (this.bribesUsed > player.doubloons) {
      return { valid: false, reason: 'Not enough doubloons for bribes' };
    }

    // Validate placements
    for (const placement of this.placements) {
      const hex = board.getHex(placement.hex);
      if (!hex) {
        return { valid: false, reason: 'Invalid hex coordinate' };
      }

      // Check if hex has player's pieces or is empty and has their port
      const playerShips = hex.getPlayerShips(this.playerId);
      const hasPlayerPieces = playerShips.length > 0;
      const isPortHex = player.portLocation &&
        player.portLocation.q === placement.hex.q &&
        player.portLocation.r === placement.hex.r;

      if (!hasPlayerPieces && !isPortHex) {
        return { valid: false, reason: 'Must build in hex with your pieces or port' };
      }

      // Check for enemy pieces
      const allPlayerIds = hex.getPlayerIds();
      const hasEnemyPieces = allPlayerIds.some(id => id !== this.playerId);
      if (hasEnemyPieces && !isPortHex) {
        return { valid: false, reason: 'Cannot build in hex with enemy pieces (except port hex)' };
      }

      // Check player has the ship to place
      if (placement.shipType === ShipType.SLOOP && !player.hasShips('sloops', 1)) {
        return { valid: false, reason: 'Not enough sloops' };
      }
      if (placement.shipType === ShipType.GALLEON && !player.hasShips('galleons', 1)) {
        return { valid: false, reason: 'Not enough galleons' };
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
    const board = gameState.board;

    // Spend doubloons for bribes
    if (this.bribesUsed > 0) {
      player.spendDoubloons(this.bribesUsed);
    }

    // Place ships
    let sloopsPlaced = 0;
    let galleonsPlaced = 0;

    for (const placement of this.placements) {
      let ship: Ship;

      if (placement.shipType === ShipType.SLOOP) {
        ship = Ship.createSloop(this.playerId);
        player.spendShips('sloops', 1);
        sloopsPlaced++;
      } else {
        ship = Ship.createGalleon(this.playerId);
        player.spendShips('galleons', 1);
        galleonsPlaced++;
      }

      board.placeShip(placement.hex, ship);
    }

    const description = this.placements.length === 1
      ? `Placed ${galleonsPlaced > 0 ? 'Galleon' : 'Sloop'}`
      : `Placed ${sloopsPlaced} Sloop(s) and ${galleonsPlaced} Galleon(s)`;

    gameState.forceUpdate();

    return this.createSuccessResult(description);
  }

  describe(): string {
    const shipCounts = this.placements.reduce((acc, p) => {
      if (p.shipType === ShipType.SLOOP) acc.sloops++;
      else acc.galleons++;
      return acc;
    }, { sloops: 0, galleons: 0 });

    return `Build: ${shipCounts.galleons} Galleon(s), ${shipCounts.sloops} Sloop(s)`;
  }

  /**
   * Helper: Create a standard Build action (2 sloops or 1 galleon)
   */
  static createStandard(
    playerId: string,
    hex: HexCoord,
    useGalleon: boolean,
    bribes: number = 0
  ): BuildAction {
    const placements = useGalleon
      ? [{ hex, shipType: ShipType.GALLEON }]
      : [
          { hex, shipType: ShipType.SLOOP },
          { hex, shipType: ShipType.SLOOP }
        ];

    // Add bribe sloop if applicable
    if (bribes > 0) {
      for (let i = 0; i < bribes; i++) {
        placements.push({ hex, shipType: ShipType.SLOOP });
      }
    }

    return new BuildAction(playerId, placements, bribes);
  }
}
