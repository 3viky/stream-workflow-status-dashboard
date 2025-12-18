/**
 * Database queries for commits table
 */

import type Database from 'better-sqlite3';
import type { Commit, CommitWithStream } from '../../types/index.js';

/**
 * Insert a new commit
 */
export function insertCommit(db: Database.Database, commit: Commit): number {
  const stmt = db.prepare(`
    INSERT INTO commits (stream_id, commit_hash, message, author, files_changed, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    commit.streamId,
    commit.commitHash,
    commit.message,
    commit.author,
    commit.filesChanged,
    commit.timestamp
  );

  return result.lastInsertRowid as number;
}

/**
 * Alias for insertCommit
 */
export const addCommit = insertCommit;

/**
 * Get commits for a stream
 */
export function getCommitsByStream(db: Database.Database, streamId: string): Commit[] {
  const stmt = db.prepare(`
    SELECT * FROM commits WHERE stream_id = ? ORDER BY timestamp DESC
  `);

  const rows = stmt.all(streamId) as Record<string, unknown>[];
  return rows.map(rowToCommit);
}

/**
 * Get all commits
 */
export function getAllCommits(db: Database.Database): Commit[] {
  const stmt = db.prepare(`
    SELECT * FROM commits ORDER BY timestamp DESC
  `);

  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(rowToCommit);
}

/**
 * Get recent commits with limit and offset
 */
export function getRecentCommits(
  db: Database.Database,
  limit: number = 20,
  offset: number = 0
): CommitWithStream[] {
  const stmt = db.prepare(`
    SELECT
      c.*,
      s.stream_number,
      s.title as stream_title
    FROM commits c
    LEFT JOIN streams s ON c.stream_id = s.id
    ORDER BY c.timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset) as Record<string, unknown>[];
  return rows.map((row) => ({
    ...rowToCommit(row),
    streamNumber: row.stream_number as string | undefined,
    streamTitle: row.stream_title as string | undefined,
  }));
}

/**
 * Get commits for a specific stream with limit
 */
export function getStreamCommits(
  db: Database.Database,
  streamId: string,
  limit: number = 20
): Commit[] {
  const stmt = db.prepare(`
    SELECT * FROM commits WHERE stream_id = ? ORDER BY timestamp DESC LIMIT ?
  `);

  const rows = stmt.all(streamId, limit) as Record<string, unknown>[];
  return rows.map(rowToCommit);
}

/**
 * Get commits count for a stream
 */
export function getCommitsCountByStream(db: Database.Database, streamId: string): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM commits WHERE stream_id = ?
  `);

  const row = stmt.get(streamId) as { count: number };
  return row.count;
}

/**
 * Get total commits count
 */
export function getTotalCommitsCount(db: Database.Database): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM commits
  `);

  const row = stmt.get() as { count: number };
  return row.count;
}

/**
 * Get commits count for today
 */
export function getCommitsCountToday(db: Database.Database): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM commits WHERE timestamp >= ?
  `);

  const row = stmt.get(todayStart.toISOString()) as { count: number };
  return row.count;
}

function rowToCommit(row: Record<string, unknown>): Commit {
  return {
    id: row.id as number,
    streamId: row.stream_id as string,
    commitHash: row.commit_hash as string,
    message: row.message as string,
    author: row.author as string,
    filesChanged: row.files_changed as number,
    timestamp: row.timestamp as string,
  };
}
