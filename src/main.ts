import * as Phaser from 'phaser';
import { GAME_CONFIG } from './config/GameConfig';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

/**
 * Main entry point for the Notorious game
 */

// Add scenes to config
const config: Phaser.Types.Core.GameConfig = {
  ...GAME_CONFIG,
  scene: [GameScene, UIScene]
};

// Create and start the game
window.addEventListener('load', () => {
  const game = new Phaser.Game(config);

  console.log('Notorious game started!');
  console.log('Click on hexes to select them and see their information in the console.');
});
