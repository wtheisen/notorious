/**
 * Power Strategies Index
 *
 * Importing this file registers all power strategies with the PowerRegistry.
 * Each power class calls registerPower() when its module is loaded.
 */

// Import all power strategies to trigger auto-registration
import './SailorPower';
import './PeacefulPower';
import './RelentlessPower';
import './IslanderPower';

// Re-export for convenience
export { SailorPower } from './SailorPower';
export { PeacefulPower } from './PeacefulPower';
export { RelentlessPower } from './RelentlessPower';
export { IslanderPower } from './IslanderPower';
