/**
 * @baseline/core - Core Baseline Functionality
 * 
 * This package contains all core functionality that can be used by:
 * - CLI tool (@baseline/cli)
 * - GUI application (@baseline/gui)
 * - Other consumers
 */

// Export config
export * from './config/index.js';

// Export types
export * from './types/index.js';

// Export utils
export * from './utils/index.js';

// Export plugins
export * from './plugins/index.js';

// Export command functions (not CLI wrappers)
export * from './commands/index.js';

