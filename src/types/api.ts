/**
 * API parameter type definitions
 */

import type { StreamCategory, StreamPriority, StreamStatus } from './stream.js';

export interface AddStreamParams {
  streamId: string;
  streamNumber: string;
  title: string;
  category: StreamCategory;
  priority: StreamPriority;
  worktreePath: string;
  branch: string;
  estimatedPhases?: string[];
}

export interface UpdateStreamParams {
  streamId: string;
  status?: StreamStatus;
  progress?: number;
  currentPhase?: number;
  blockedBy?: string;
}

export interface AddCommitParams {
  streamId: string;
  commitHash: string;
  message: string;
  author: string;
  filesChanged: number;
  timestamp?: string;
}

export interface RemoveStreamParams {
  streamId: string;
  completionSummary?: string;
}

export interface StreamFilters {
  status?: StreamStatus;
  category?: StreamCategory;
  priority?: StreamPriority;
}

export interface CommitFilters {
  streamId?: string;
  limit?: number;
  offset?: number;
}
