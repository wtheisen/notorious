/**
 * Pirate Powers System
 *
 * This module provides a strategy pattern for pirate powers.
 * Each power is a separate class that overrides only the methods it needs.
 *
 * Usage:
 *   import { getPowerStrategy } from './core/powers';
 *   const power = getPowerStrategy(player.piratePower);
 *   const maxDistance = power.getSailMaxDistance();
 */

// Import strategies to trigger auto-registration
import './strategies';

// Export public API
export { PiratePowerStrategy } from './PiratePowerStrategy';
export { BasePiratePower } from './BasePiratePower';
export {
  getPowerStrategy,
  getAllPowers,
  getAllPowerIds,
  isPowerRegistered,
} from './PowerRegistry';
