/**
 * Stream-related type definitions
 * SINGLE SOURCE OF TRUTH for all stream types
 */

export type StreamStatus = 'initializing' | 'active' | 'blocked' | 'paused' | 'completed' | 'archived';

export type StreamCategory = 'frontend' | 'backend' | 'infrastructure' | 'testing' | 'documentation' | 'refactoring';

export type StreamPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Stream {
  id: string;
  streamNumber: string;
  title: string;
  category: StreamCategory;
  priority: StreamPriority;
  status: StreamStatus;
  progress: number;
  currentPhase?: number;
  worktreePath: string;
  branch: string;
  blockedBy?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  phases?: string[];
}

export interface StreamWithActivity extends Stream {
  recentActivity?: {
    lastCommit?: string;
    lastCommitTime?: string;
    filesChanged?: number;
  };
}
