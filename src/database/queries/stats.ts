/**
 * Statistics and analytics queries
 */
import type Database from 'better-sqlite3';
import type { QuickStats } from '../../types/index.js';
import { DatabaseError } from '../errors.js';

/**
 * Get quick statistics dashboard
 */
export function getQuickStats(db: Database.Database): QuickStats {
  try {
    const totalStreamsStmt = db.prepare(`
      SELECT COUNT(*) as count FROM streams
      WHERE status NOT IN ('completed', 'archived')
    `);
    const activeStreams = (totalStreamsStmt.get() as { count: number }).count;

    const inProgress = getStreamsCountByStatus(db, 'active');
    const blocked = getStreamsCountByStatus(db, 'blocked');
    const readyToStart = getStreamsCountByStatus(db, 'paused');
    const completedToday = getCompletedToday(db);

    const totalCommitsStmt = db.prepare('SELECT COUNT(*) as count FROM commits');
    const totalCommits = (totalCommitsStmt.get() as { count: number }).count;

    const commitsToday = getCommitsToday(db);

    return {
      activeStreams,
      inProgress,
      blocked,
      readyToStart,
      completedToday,
      totalCommits,
      commitsToday,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get quick stats', 'getQuickStats', error);
  }
}

/**
 * Get count of streams by status
 */
export function getStreamsCountByStatus(db: Database.Database, status: string): number {
  try {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM streams WHERE status = ?
    `);

    const result = stmt.get(status) as { count: number };
    return result.count;
  } catch (error) {
    throw new DatabaseError(
      `Failed to get streams count by status ${status}`,
      'getStreamsCountByStatus',
      error
    );
  }
}

/**
 * Get count of commits made today
 */
export function getCommitsToday(db: Database.Database): number {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM commits
      WHERE timestamp >= ?
    `);

    const result = stmt.get(todayStart) as { count: number };
    return result.count;
  } catch (error) {
    throw new DatabaseError('Failed to get commits today', 'getCommitsToday', error);
  }
}

/**
 * Get count of streams completed today
 */
export function getCompletedToday(db: Database.Database): number {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM streams
      WHERE completed_at >= ?
    `);

    const result = stmt.get(todayStart) as { count: number };
    return result.count;
  } catch (error) {
    throw new DatabaseError('Failed to get completed streams today', 'getCompletedToday', error);
  }
}
