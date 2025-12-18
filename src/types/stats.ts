/**
 * Statistics type definitions
 */

export interface QuickStats {
  activeStreams: number;
  inProgress: number;
  blocked: number;
  readyToStart: number;
  completedToday: number;
  totalCommits: number;
  commitsToday: number;
}
