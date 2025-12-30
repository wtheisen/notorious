import { PiratePower } from '../../types/GameTypes';
import { PiratePowerStrategy } from './PiratePowerStrategy';

/**
 * Registry for all pirate power strategies
 * Powers register themselves when their module is imported
 */
const powerRegistry = new Map<PiratePower, PiratePowerStrategy>();

/**
 * Register a power strategy
 * Called by each power class when its module loads
 */
export function registerPower(power: PiratePowerStrategy): void {
  if (powerRegistry.has(power.id)) {
    console.warn(`[PowerRegistry] Power ${power.id} already registered, overwriting`);
  }
  powerRegistry.set(power.id, power);
  console.log(`[PowerRegistry] Registered power: ${power.name}`);
}

/**
 * Get the strategy for a given power
 * @throws Error if power is not registered
 */
export function getPowerStrategy(id: PiratePower): PiratePowerStrategy {
  const strategy = powerRegistry.get(id);
  if (!strategy) {
    throw new Error(`[PowerRegistry] Unknown power: ${id}. Make sure the power module is imported.`);
  }
  return strategy;
}

/**
 * Get all registered powers
 * Useful for UI display or random selection
 */
export function getAllPowers(): PiratePowerStrategy[] {
  return Array.from(powerRegistry.values());
}

/**
 * Get all registered power IDs
 */
export function getAllPowerIds(): PiratePower[] {
  return Array.from(powerRegistry.keys());
}

/**
 * Check if a power is registered
 */
export function isPowerRegistered(id: PiratePower): boolean {
  return powerRegistry.has(id);
}
