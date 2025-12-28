/**
 * Commit Enrichment Utilities
 *
 * Pure functions for transforming raw commits into enriched timeline data.
 * Client-side JOIN with streams data - no API changes required.
 */

import type {
  Commit,
  Stream,
  EnrichedCommit,
  ActivityLevel,
  GroupingKey,
  GroupBy,
  WorktreeSummary,
} from '../../types/index.js';

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

/**
 * Format timestamp as relative time string
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / HOUR_MS);
  const days = Math.floor(diffMs / DAY_MS);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Calculate activity level based on recency
 */
export function getActivityLevel(timestamp: string): ActivityLevel {
  const date = new Date(timestamp);
  const now = new Date();
  const hoursAgo = (now.getTime() - date.getTime()) / HOUR_MS;

  if (hoursAgo < 1) return 'hot';
  if (hoursAgo < 6) return 'warm';
  return 'cold';
}

/**
 * Get grouping key for temporal organization
 */
export function getGroupingKey(timestamp: string): GroupingKey {
  const date = new Date(timestamp);
  const now = new Date();
  const hoursAgo = (now.getTime() - date.getTime()) / HOUR_MS;

  if (hoursAgo < 24) return 'today';
  if (hoursAgo < 48) return 'yesterday';
  if (hoursAgo < 168) return 'this-week'; // 7 days
  return 'older';
}

/**
 * Get display label for grouping key
 */
export function getGroupLabel(key: GroupingKey | string): string {
  switch (key) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'this-week': return 'This Week';
    case 'older': return 'Older';
    default: return key;
  }
}

/**
 * Enrich commits with stream context and derived fields
 */
export function enrichCommits(
  commits: Commit[],
  streams: Stream[]
): EnrichedCommit[] {
  const streamMap = new Map(streams.map(s => [s.id, s]));

  return commits.map(commit => {
    const stream = streamMap.get(commit.streamId);
    const isMerged = stream?.status === 'completed';

    return {
      ...commit,
      relativeTime: formatRelativeTime(commit.timestamp),
      groupingKey: getGroupingKey(commit.timestamp),
      activityLevel: getActivityLevel(commit.timestamp),
      isMerged,
      streamContext: stream ? {
        title: stream.title,
        branch: stream.branch,
        worktreePath: stream.worktreePath,
        category: stream.category,
        status: stream.status,
      } : undefined,
    };
  });
}

/**
 * Group commits by the specified key
 */
export function groupCommits(
  commits: EnrichedCommit[],
  groupBy: GroupBy
): Map<string, EnrichedCommit[]> {
  const groups = new Map<string, EnrichedCommit[]>();

  // Define group order for time-based grouping
  const timeOrder: GroupingKey[] = ['today', 'yesterday', 'this-week', 'older'];

  for (const commit of commits) {
    let key: string;

    switch (groupBy) {
      case 'time':
        key = commit.groupingKey;
        break;
      case 'stream':
        key = commit.streamNumber || commit.streamId || 'Unknown';
        break;
      case 'author':
        key = commit.author || 'Unknown';
        break;
      default:
        key = commit.groupingKey;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(commit);
  }

  // Sort groups for time-based grouping
  if (groupBy === 'time') {
    const sortedGroups = new Map<string, EnrichedCommit[]>();
    for (const key of timeOrder) {
      if (groups.has(key)) {
        sortedGroups.set(key, groups.get(key)!);
      }
    }
    return sortedGroups;
  }

  return groups;
}

/**
 * Calculate worktree summary for header display
 */
export function calculateWorktreeSummary(streams: Stream[]): WorktreeSummary {
  let activeCount = 0;
  let mergedCount = 0;

  for (const stream of streams) {
    if (stream.status === 'completed') {
      mergedCount++;
    } else if (stream.status === 'active' || stream.status === 'initializing') {
      activeCount++;
    }
  }

  return { activeCount, mergedCount };
}

/**
 * Get unique authors from commits
 */
export function getUniqueAuthors(commits: Commit[]): string[] {
  const authors = new Set<string>();
  for (const commit of commits) {
    if (commit.author) {
      authors.add(commit.author);
    }
  }
  return Array.from(authors).sort();
}

/**
 * Get unique streams from commits
 */
export function getUniqueStreams(commits: Commit[]): Array<{ id: string; number: string }> {
  const streams = new Map<string, string>();
  for (const commit of commits) {
    if (commit.streamId && !streams.has(commit.streamId)) {
      streams.set(commit.streamId, commit.streamNumber || commit.streamId);
    }
  }
  return Array.from(streams.entries()).map(([id, number]) => ({ id, number }));
}
