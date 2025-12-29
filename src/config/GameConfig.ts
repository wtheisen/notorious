import * as Phaser from 'phaser';

/**
 * Phaser game configuration
 */
export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1200,
  height: 800,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0, x: 0 },
      debug: false
    }
  }
};

/**
 * Game-wide constants
 */
export const GAME_SETTINGS = {
  // Visual settings
  HEX_SIZE: 50,
  BOARD_CENTER_X: 600,
  BOARD_CENTER_Y: 400,

  // Colors
  COLORS: {
    OCEAN: 0x4a90a4,
    ISLAND: 0xc4a363,
    HIGHLIGHT: 0xffff00,
    PLAYER_BLUE: 0x0066ff,
    PLAYER_RED: 0xff3333
  },

  // Animation settings
  ANIMATION_DURATION: 300, // milliseconds
  HOVER_SCALE: 1.1
} as const;
