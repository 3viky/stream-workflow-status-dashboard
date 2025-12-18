/**
 * Database queries for streams table
 */

import type Database from 'better-sqlite3';
import type { Stream, StreamStatus, StreamWithActivity } from '../../types/index.js';

/**
 * Insert a new stream
 */
export function insertStream(db: Database.Database, stream: Stream): void {
  const stmt = db.prepare(`
    INSERT INTO streams (
      id, stream_number, title, category, priority, status, progress,
      current_phase, worktree_path, branch, blocked_by, created_at,
      updated_at, completed_at, phases
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    stream.id,
    stream.streamNumber,
    stream.title,
    stream.category,
    stream.priority,
    stream.status,
    stream.progress,
    stream.currentPhase ?? null,
    stream.worktreePath,
    stream.branch,
    stream.blockedBy ?? null,
    stream.createdAt,
    stream.updatedAt,
    stream.completedAt ?? null,
    stream.phases ? JSON.stringify(stream.phases) : null
  );
}

/**
 * Update stream fields
 */
export function updateStream(
  db: Database.Database,
  streamId: string,
  updates: {
    status?: StreamStatus;
    progress?: number;
    currentPhase?: number;
    blockedBy?: string;
  }
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(updates.progress);
  }
  if (updates.currentPhase !== undefined) {
    fields.push('current_phase = ?');
    values.push(updates.currentPhase);
  }
  if (updates.blockedBy !== undefined) {
    fields.push('blocked_by = ?');
    values.push(updates.blockedBy || null);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(streamId);

  const stmt = db.prepare(`
    UPDATE streams
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);
}

/**
 * Get stream by ID
 */
export function getStreamById(db: Database.Database, streamId: string): Stream | undefined {
  const stmt = db.prepare(`
    SELECT * FROM streams WHERE id = ?
  `);

  const row = stmt.get(streamId) as Record<string, unknown> | undefined;
  if (!row) {
    return undefined;
  }

  return rowToStream(row);
}

/**
 * Get all streams with optional filters
 */
export function getAllStreams(
  db: Database.Database,
  filters?: {
    status?: string;
    category?: string;
  }
): StreamWithActivity[] {
  let query = `
    SELECT
      s.*,
      c.message as last_commit_message,
      c.files_changed as last_commit_files,
      c.timestamp as last_commit_time,
      c.author as last_commit_author
    FROM streams s
    LEFT JOIN (
      SELECT stream_id, message, files_changed, timestamp, author,
             ROW_NUMBER() OVER (PARTITION BY stream_id ORDER BY timestamp DESC) as rn
      FROM commits
    ) c ON s.id = c.stream_id AND c.rn = 1
    WHERE s.id != 'main'
  `;
  const params: unknown[] = [];

  if (filters?.status) {
    query += ` AND s.status = ?`;
    params.push(filters.status);
  }

  if (filters?.category) {
    query += ` AND s.category = ?`;
    params.push(filters.category);
  }

  query += ` ORDER BY s.updated_at DESC`;

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as Record<string, unknown>[];
  return rows.map(rowToStreamWithActivity);
}

function rowToStreamWithActivity(row: Record<string, unknown>): StreamWithActivity {
  const stream = rowToStream(row) as StreamWithActivity;

  if (row.last_commit_message) {
    stream.recentActivity = {
      lastCommit: row.last_commit_message as string,
      filesChanged: (row.last_commit_files as number) || 0,
      lastCommitTime: formatRelativeTime(row.last_commit_time as string),
    };
  }

  return stream;
}

function formatRelativeTime(isoTimestamp: string): string {
  if (!isoTimestamp) return '';

  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Get stream by ID (alias)
 */
export function getStream(db: Database.Database, streamId: string): Stream | undefined {
  return getStreamById(db, streamId);
}

/**
 * Get streams by status
 */
export function getStreamsByStatus(db: Database.Database, status: StreamStatus): Stream[] {
  const stmt = db.prepare(`
    SELECT * FROM streams WHERE status = ? ORDER BY updated_at DESC
  `);

  const rows = stmt.all(status) as Record<string, unknown>[];
  return rows.map(rowToStream);
}

/**
 * Mark stream as completed
 */
export function completeStream(db: Database.Database, streamId: string): void {
  const stmt = db.prepare(`
    UPDATE streams
    SET status = 'completed',
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `);

  const now = new Date().toISOString();
  stmt.run(now, now, streamId);
}

/**
 * Update stream's updated_at timestamp
 */
export function touchStream(db: Database.Database, streamId: string): void {
  const stmt = db.prepare(`
    UPDATE streams SET updated_at = ? WHERE id = ?
  `);

  stmt.run(new Date().toISOString(), streamId);
}

/**
 * Delete stream from database
 */
export function deleteStream(db: Database.Database, streamId: string): void {
  const deleteCommitsStmt = db.prepare(`
    DELETE FROM commits WHERE stream_id = ?
  `);
  deleteCommitsStmt.run(streamId);

  const deleteHistoryStmt = db.prepare(`
    DELETE FROM stream_history WHERE stream_id = ?
  `);
  deleteHistoryStmt.run(streamId);

  const deleteStreamStmt = db.prepare(`
    DELETE FROM streams WHERE id = ?
  `);
  deleteStreamStmt.run(streamId);

  console.log(`[deleteStream] Stream ${streamId} removed from database`);
}

function rowToStream(row: Record<string, unknown>): Stream {
  return {
    id: row.id as string,
    streamNumber: row.stream_number as string,
    title: row.title as string,
    category: row.category as Stream['category'],
    priority: row.priority as Stream['priority'],
    status: row.status as Stream['status'],
    progress: row.progress as number,
    currentPhase: (row.current_phase as number) ?? undefined,
    worktreePath: row.worktree_path as string,
    branch: row.branch as string,
    blockedBy: (row.blocked_by as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string) ?? undefined,
    phases: row.phases ? JSON.parse(row.phases as string) : undefined,
  };
}
