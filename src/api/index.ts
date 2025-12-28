/**
 * API Server exports
 *
 * Provides programmatic access to the API server, including:
 * - Server startup and lifecycle management
 * - Express app creation for testing/embedding
 * - Server discovery for multi-agent coordination
 * - Real-time event broadcasting
 */

// Server lifecycle
export { startApiServer, createApp, stopPeriodicScanning } from './server.js';

// Server discovery
export {
  discoverApiServer,
  findAvailablePort,
  writeLockFile,
  removeLockFile,
  setupGracefulShutdown,
} from './discovery.js';

// Real-time events
export { eventManager, notifyUpdate } from './events.js';

// Route factories
export {
  createStreamsRouter,
  createCommitsRouter,
  createStatsRouter,
  createReconciliationRouter,
} from './routes/index.js';
