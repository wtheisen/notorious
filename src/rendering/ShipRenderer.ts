import * as Phaser from 'phaser';
import { Hex } from '../core/Hex';
import { Ship } from '../core/Ship';
import { ShipType } from '../types/GameTypes';
import { hexToPixel } from '../utils/HexMath';
import { BOARD_CENTER } from '../config/HexConstants';
import { PlayerColor } from '../types/GameTypes';

/**
 * Handles rendering of ships on hexes
 */
export class ShipRenderer {
  private scene: Phaser.Scene;
  private centerX: number;
  private centerY: number;

  // Ship visual constants
  private readonly SLOOP_RADIUS = 8;
  private readonly GALLEON_RADIUS = 14;
  private readonly PORT_SIZE = 18;

  // Player colors
  private readonly PLAYER_COLORS: { [key: string]: number } = {
    [PlayerColor.BLUE]: 0x0066ff,
    [PlayerColor.RED]: 0xff3333,
    [PlayerColor.GREEN]: 0x33ff66,
    [PlayerColor.YELLOW]: 0xffff33
  };

  private shipGraphics: Map<string, Phaser.GameObjects.Graphics>;

  constructor(scene: Phaser.Scene, centerX: number = BOARD_CENTER.x, centerY: number = BOARD_CENTER.y) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
    this.shipGraphics = new Map();
  }

  /**
   * Render all ships in a hex
   */
  renderShips(hex: Hex): void {
    const pixel = hexToPixel(hex.coord, this.centerX, this.centerY);
    const allShips = hex.getAllShips();

    // Group ships by player
    const shipsByPlayer = new Map<string, Ship[]>();
    for (const ship of allShips) {
      const playerShips = shipsByPlayer.get(ship.playerId) || [];
      playerShips.push(ship);
      shipsByPlayer.set(ship.playerId, playerShips);
    }

    // Position ships around the hex center
    let playerIndex = 0;
    const playerCount = shipsByPlayer.size;

    for (const [playerId, ships] of shipsByPlayer.entries()) {
      // Calculate base position for this player's ships
      const angle = (2 * Math.PI * playerIndex) / playerCount;
      const offsetX = Math.cos(angle) * 20;
      const offsetY = Math.sin(angle) * 20;

      // Render each ship type for this player
      const sloops = ships.filter(s => s.type === ShipType.SLOOP);
      const galleons = ships.filter(s => s.type === ShipType.GALLEON);
      const ports = ships.filter(s => s.type === ShipType.PORT);

      let shipOffset = 0;

      // Render ports (largest)
      for (const port of ports) {
        this.renderShip(
          port,
          pixel.x + offsetX,
          pixel.y + offsetY + shipOffset,
          playerId
        );
        shipOffset += 22;
      }

      // Render galleons
      for (const galleon of galleons) {
        this.renderShip(
          galleon,
          pixel.x + offsetX,
          pixel.y + offsetY + shipOffset,
          playerId
        );
        shipOffset += 18;
      }

      // Render sloops (smallest)
      for (const sloop of sloops) {
        this.renderShip(
          sloop,
          pixel.x + offsetX,
          pixel.y + offsetY + shipOffset,
          playerId
        );
        shipOffset += 12;
      }

      playerIndex++;
    }
  }

  /**
   * Render a single ship
   */
  private renderShip(ship: Ship, x: number, y: number, playerId: string): void {
    const graphics = this.scene.add.graphics();
    const color = this.getPlayerColor(playerId);

    graphics.fillStyle(color, 1.0);
    graphics.lineStyle(2, 0x000000, 1.0);

    switch (ship.type) {
      case ShipType.SLOOP:
        // Small circle
        graphics.fillCircle(x, y, this.SLOOP_RADIUS);
        graphics.strokeCircle(x, y, this.SLOOP_RADIUS);
        break;

      case ShipType.GALLEON:
        // Large circle
        graphics.fillCircle(x, y, this.GALLEON_RADIUS);
        graphics.strokeCircle(x, y, this.GALLEON_RADIUS);
        break;

      case ShipType.PORT:
        // Triangle (pointing up)
        graphics.beginPath();
        graphics.moveTo(x, y - this.PORT_SIZE);
        graphics.lineTo(x - this.PORT_SIZE, y + this.PORT_SIZE);
        graphics.lineTo(x + this.PORT_SIZE, y + this.PORT_SIZE);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
    }

    // Store graphics object for cleanup
    const key = `${ship.playerId}-${ship.type}-${x}-${y}`;
    this.shipGraphics.set(key, graphics);
  }

  /**
   * Get color for a player
   */
  private getPlayerColor(playerId: string): number {
    // Default color mapping - can be improved with actual player data
    if (playerId.includes('0') || playerId.toLowerCase().includes('player')) {
      return this.PLAYER_COLORS[PlayerColor.BLUE];
    }
    return this.PLAYER_COLORS[PlayerColor.RED];
  }

  /**
   * Clear all ship graphics
   */
  clear(): void {
    for (const graphics of this.shipGraphics.values()) {
      graphics.destroy();
    }
    this.shipGraphics.clear();
  }

  /**
   * Destroy all graphics
   */
  destroy(): void {
    this.clear();
  }
}
