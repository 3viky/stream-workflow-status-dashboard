/**
 * Commit-related type definitions
 */

export interface Commit {
  id?: number;
  streamId: string;
  commitHash: string;
  message: string;
  author: string;
  filesChanged: number;
  timestamp: string;
}

export interface CommitWithStream extends Commit {
  streamNumber?: string;
  streamTitle?: string;
}
