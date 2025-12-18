/**
 * Summary jobs database queries
 */

import type Database from 'better-sqlite3';
import type { Stream } from '../../types/index.js';

export interface SummaryJob {
  id: number;
  stream_id: string;
  stream_number: string;
  stream_title: string;
  stream_category: string;
  stream_branch: string;
  stream_worktree_path: string;
  stream_created_at: string;
  stream_completed_at: string | null;
  user_summary: string;
  history_file_path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Queue a new summary generation job
 */
export function queueSummaryJob(
  db: Database.Database,
  stream: Stream,
  userSummary: string,
  historyFilePath: string
): number {
  const stmt = db.prepare(`
    INSERT INTO summary_jobs (
      stream_id,
      stream_number,
      stream_title,
      stream_category,
      stream_branch,
      stream_worktree_path,
      stream_created_at,
      stream_completed_at,
      user_summary,
      history_file_path,
      status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `);

  const result = stmt.run(
    stream.id,
    stream.streamNumber,
    stream.title,
    stream.category,
    stream.branch,
    stream.worktreePath,
    stream.createdAt,
    stream.completedAt,
    userSummary,
    historyFilePath
  );

  return result.lastInsertRowid as number;
}

/**
 * Get pending job count
 */
export function getPendingJobCount(db: Database.Database): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM summary_jobs
    WHERE status = 'pending'
      AND attempts < max_attempts
  `);

  const result = stmt.get() as { count: number };
  return result.count;
}

/**
 * Get all pending jobs
 */
export function getPendingJobs(db: Database.Database): SummaryJob[] {
  const stmt = db.prepare(`
    SELECT *
    FROM summary_jobs
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY created_at ASC
  `);

  return stmt.all() as SummaryJob[];
}

/**
 * Get job by ID
 */
export function getJob(db: Database.Database, jobId: number): SummaryJob | null {
  const stmt = db.prepare(`SELECT * FROM summary_jobs WHERE id = ?`);
  return stmt.get(jobId) as SummaryJob | null;
}

/**
 * Delete job (after completion or max retries)
 */
export function deleteJob(db: Database.Database, jobId: number): void {
  const stmt = db.prepare(`DELETE FROM summary_jobs WHERE id = ?`);
  stmt.run(jobId);
}
