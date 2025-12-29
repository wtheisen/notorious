import { ShipType, GAME_CONSTANTS } from '../types/GameTypes';

/**
 * Represents a ship on the board
 * Ships have different influence values: Sloop=1, Galleon=2, Port=3
 */
export class Ship {
  public readonly type: ShipType;
  public readonly playerId: string;

  constructor(type: ShipType, playerId: string) {
    this.type = type;
    this.playerId = playerId;
  }

  /**
   * Get the influence value of this ship
   */
  get influence(): number {
    return GAME_CONSTANTS.INFLUENCE_VALUES[this.type];
  }

  /**
   * Factory method to create a Sloop
   */
  static createSloop(playerId: string): Ship {
    return new Ship(ShipType.SLOOP, playerId);
  }

  /**
   * Factory method to create a Galleon
   */
  static createGalleon(playerId: string): Ship {
    return new Ship(ShipType.GALLEON, playerId);
  }

  /**
   * Factory method to create a Port
   */
  static createPort(playerId: string): Ship {
    return new Ship(ShipType.PORT, playerId);
  }

  /**
   * Check if this ship matches another
   */
  equals(other: Ship): boolean {
    return this.type === other.type && this.playerId === other.playerId;
  }
}
