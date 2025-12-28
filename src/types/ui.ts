/**
 * UI-specific type definitions
 * These extend core types with display/interaction concerns
 */

import type { StreamStatus, StreamCategory, StreamPriority } from './stream.js';
import type { Commit } from './commit.js';

export interface FilterOptions {
  status: StreamStatus | 'all';
  category: StreamCategory | 'all';
  priority: StreamPriority | 'all';
  search: string;
}

export type ActivityLevel = 'hot' | 'warm' | 'cold';
export type GroupingKey = 'today' | 'yesterday' | 'this-week' | 'older';
export type GroupBy = 'time' | 'stream' | 'author';

export interface StreamContext {
  title: string;
  branch?: string;
  worktreePath?: string;
  category: StreamCategory;
  status: StreamStatus;
}

export interface EnrichedCommit extends Commit {
  relativeTime: string;
  groupingKey: GroupingKey;
  activityLevel: ActivityLevel;
  streamContext?: StreamContext;
  isMerged: boolean;
}

export interface TimelineFilters {
  streams: string[];
  authors: string[];
  timeRange: 'hour' | '6h' | '24h' | '7d' | '30d' | 'all';
  activeOnly: boolean;
}

export interface WorktreeSummary {
  activeCount: number;
  mergedCount: number;
}
