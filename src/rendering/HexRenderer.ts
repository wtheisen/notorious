import * as Phaser from 'phaser';
import { Hex } from '../core/Hex';
import { HexCoord, PixelCoord } from '../types/CoordinateTypes';
import { hexToPixel, pixelToHex, getHexCorners, HEX_SIZE } from '../utils/HexMath';
import { BOARD_CENTER } from '../config/HexConstants';

/**
 * Handles rendering of hexagons on the game board
 */
export class HexRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private centerX: number;
  private centerY: number;

  // Color constants
  private readonly OCEAN_COLOR = 0x4a90a4;
  private readonly ISLAND_COLOR = 0xc4a363;
  private readonly HEX_OUTLINE = 0x2d5a6b;
  private readonly HIGHLIGHT_COLOR = 0xffff00;
  private readonly CONTROL_COLORS = {
    BLUE: 0x0066cc,
    RED: 0xcc0000,
    GREEN: 0x00cc66,
    YELLOW: 0xcccc00
  };

  constructor(scene: Phaser.Scene, centerX: number = BOARD_CENTER.x, centerY: number = BOARD_CENTER.y) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
    this.graphics = scene.add.graphics();
  }

  /**
   * Draw a single hex
   */
  drawHex(hex: Hex, controller: string | null = null): void {
    const pixel = hexToPixel(hex.coord, this.centerX, this.centerY);
    const corners = getHexCorners(pixel, HEX_SIZE);

    // Determine fill color
    const fillColor = hex.hasIsland() ? this.ISLAND_COLOR : this.OCEAN_COLOR;

    // Draw hex fill
    this.graphics.fillStyle(fillColor, 1.0);
    this.graphics.beginPath();
    this.graphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.graphics.lineTo(corners[i].x, corners[i].y);
    }
    this.graphics.closePath();
    this.graphics.fillPath();

    // Draw hex outline
    this.graphics.lineStyle(2, this.HEX_OUTLINE, 1.0);
    this.graphics.strokePath();

    // If hex is controlled, draw a thicker colored outline
    if (controller) {
      const controlColor = this.getControlColor(controller);
      this.graphics.lineStyle(4, controlColor, 0.6);
      this.graphics.strokePath();
    }

    // Draw island impassable edges if present
    if (hex.island) {
      this.drawIslandEdges(hex, pixel);
    }
  }

  /**
   * Draw impassable edges for an island
   */
  private drawIslandEdges(hex: Hex, center: PixelCoord): void {
    if (!hex.island) return;

    const corners = getHexCorners(center, HEX_SIZE);
    this.graphics.lineStyle(6, 0x000000, 1.0);

    for (const edge of hex.island.impassableEdges) {
      // Draw thick line along impassable edge
      const startCorner = corners[edge];
      const endCorner = corners[(edge + 1) % 6];
      this.graphics.beginPath();
      this.graphics.moveTo(startCorner.x, startCorner.y);
      this.graphics.lineTo(endCorner.x, endCorner.y);
      this.graphics.strokePath();
    }
  }

  /**
   * Highlight a hex
   */
  highlightHex(coord: HexCoord, color: number = this.HIGHLIGHT_COLOR): void {
    const pixel = hexToPixel(coord, this.centerX, this.centerY);
    const corners = getHexCorners(pixel, HEX_SIZE);

    this.graphics.lineStyle(4, color, 1.0);
    this.graphics.beginPath();
    this.graphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.graphics.lineTo(corners[i].x, corners[i].y);
    }
    this.graphics.closePath();
    this.graphics.strokePath();
  }

  /**
   * Convert pixel coordinates to hex coordinates
   */
  pixelToHex(x: number, y: number): HexCoord {
    return pixelToHex({ x, y }, this.centerX, this.centerY);
  }

  /**
   * Convert hex coordinates to pixel coordinates
   */
  hexToPixel(coord: HexCoord): PixelCoord {
    return hexToPixel(coord, this.centerX, this.centerY);
  }

  /**
   * Clear all graphics
   */
  clear(): void {
    this.graphics.clear();
  }

  /**
   * Get control color for a player ID
   */
  private getControlColor(playerId: string): number {
    // Simple mapping - can be improved with actual player color
    if (playerId.includes('0') || playerId.toLowerCase().includes('player')) {
      return this.CONTROL_COLORS.BLUE;
    }
    return this.CONTROL_COLORS.RED;
  }

  /**
   * Destroy graphics object
   */
  destroy(): void {
    this.graphics.destroy();
  }
}
