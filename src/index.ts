/**
 * @3viky/stream-workflow-status-dashboard
 *
 * Core package for stream workflow status tracking.
 * This is the SINGLE SOURCE OF TRUTH for:
 * - Type definitions
 * - Database operations
 * - Services and business logic
 * - API server
 * - Client SDK
 *
 * The MCP server imports from this package and provides
 * only protocol adaptation.
 *
 * @example Programmatic usage
 * ```typescript
 * import {
 *   initializeDatabase,
 *   startApiServer,
 *   syncFromFiles,
 * } from '@3viky/stream-workflow-status-dashboard';
 *
 * const db = initializeDatabase('/path/to/database.sqlite');
 * await syncFromFiles(db, projectRoot, worktreeRoot);
 * const { port } = await startApiServer(db, config);
 * ```
 *
 * @example Client SDK usage
 * ```typescript
 * import { createHttpClient, createNodeSSEClient } from '@3viky/stream-workflow-status-dashboard/client';
 *
 * const http = createHttpClient('http://localhost:3001');
 * const stats = await http.getStats();
 *
 * const sse = createNodeSSEClient('http://localhost:3001');
 * sse.on('streams', () => console.log('Streams updated'));
 * sse.connect();
 * ```
 */

// ============================================================================
// Types (re-export from subpath for convenience)
// ============================================================================

export type {
  // Core domain types
  Stream,
  StreamWithActivity,
  StreamStatus,
  StreamCategory,
  StreamPriority,
  Commit,
  CommitWithStream,
  QuickStats,
  StreamHistoryEvent,
  HistoryEventType,

  // API types
  AddStreamParams,
  UpdateStreamParams,
  AddCommitParams,
  RemoveStreamParams,
  StreamFilters,
  CommitFilters,

  // Config types
  Config,
  ApiServerConfig,
  ServerInfo,
  ServerLock,
  DiscoveryResult,

  // Event types
  EventType,
  SSEEvent,
  SSEClientOptions,

  // UI types
  FilterOptions,
  ActivityLevel,
  GroupingKey,
  GroupBy,
  StreamContext,
  EnrichedCommit,
  TimelineFilters,
  WorktreeSummary,
} from './types/index.js';

// ============================================================================
// Database
// ============================================================================

export {
  initializeDatabase,
  getDatabase,
  closeDatabase,
} from './database/client.js';

export { DatabaseError } from './database/errors.js';

export {
  getAllStreams,
  getStream,
  getStreamById,
  insertStream,
  insertStream as addStream,
  updateStream,
  completeStream,
  deleteStream,
  touchStream,
  getStreamsByStatus,
} from './database/queries/streams.js';

export {
  getRecentCommits,
  getStreamCommits,
  addCommit,
  insertCommit,
  getCommitsByStream,
  getAllCommits,
  getCommitsCountByStream,
  getTotalCommitsCount,
  getCommitsCountToday,
} from './database/queries/commits.js';

export {
  getStreamHistory,
  addHistoryEvent,
} from './database/queries/history.js';

export {
  getQuickStats,
} from './database/queries/stats.js';

export {
  getPendingJobs,
  queueSummaryJob,
  getPendingJobCount,
  getJob,
  deleteJob,
  type SummaryJob,
} from './database/queries/summary-jobs.js';

// ============================================================================
// Services
// ============================================================================

export {
  syncFromFiles,
  parseStreamMarkdown,
} from './services/sync-service.js';

export {
  retireStream,
  type RetirementOptions,
  type RetirementResult,
} from './services/retirement-service.js';

// ============================================================================
// Scanners
// ============================================================================

export {
  scanAllWorktreeCommits,
  scanStreamCommits,
  getWorktreeCommits,
  getMainBranchCommits,
} from './scanners/git-commits.js';

export {
  reconcileWorktrees,
  getWorktreeList,
  getMergedBranches,
  type ReconciliationOptions,
  type ReconciliationResult,
} from './scanners/worktree-reconciliation.js';

// ============================================================================
// Jobs
// ============================================================================

export {
  startWorker as startSummaryWorker,
  processJob,
  processPendingJobs,
} from './jobs/summary-worker.js';

// ============================================================================
// API Server
// ============================================================================

export {
  startApiServer,
  createApp,
  stopPeriodicScanning,
} from './api/server.js';

export {
  discoverApiServer,
  findAvailablePort,
  writeLockFile,
  removeLockFile,
  setupGracefulShutdown,
} from './api/discovery.js';

export {
  eventManager,
  notifyUpdate,
} from './api/events.js';

// Route factories (for custom server configurations)
export {
  createStreamsRouter,
  createCommitsRouter,
  createStatsRouter,
  createReconciliationRouter,
} from './api/routes/index.js';
