/**
 * Type definitions - SINGLE SOURCE OF TRUTH
 * All types for stream workflow status tracking
 */

// Core domain types
export type { Stream, StreamWithActivity, StreamStatus, StreamCategory, StreamPriority } from './stream.js';
export type { Commit, CommitWithStream } from './commit.js';
export type { QuickStats } from './stats.js';
export type { StreamHistoryEvent, HistoryEventType } from './history.js';

// API types
export type {
  AddStreamParams,
  UpdateStreamParams,
  AddCommitParams,
  RemoveStreamParams,
  StreamFilters,
  CommitFilters,
} from './api.js';

// Configuration types
export type { Config, ApiServerConfig, ServerInfo, ServerLock, DiscoveryResult } from './config.js';

// Event types
export type { EventType, SSEEvent, SSEClientOptions } from './events.js';

// UI-specific types
export type {
  FilterOptions,
  ActivityLevel,
  GroupingKey,
  GroupBy,
  StreamContext,
  EnrichedCommit,
  TimelineFilters,
  WorktreeSummary,
} from './ui.js';
