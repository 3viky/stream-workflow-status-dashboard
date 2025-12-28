/**
 * Database client using better-sqlite3
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: Database.Database | null = null;

/**
 * Initialize database with schema
 */
export function initializeDatabase(databasePath: string): Database.Database {
  const dir = dirname(databasePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables(db);

  return db;
}

/**
 * Get current database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run operations in a transaction
 */
export function transaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDatabase();
  return database.transaction(fn)(database);
}

/**
 * Create database tables
 */
function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS streams (
      id TEXT PRIMARY KEY,
      stream_number TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      current_phase INTEGER,
      worktree_path TEXT NOT NULL,
      branch TEXT NOT NULL,
      blocked_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      phases TEXT,
      FOREIGN KEY (blocked_by) REFERENCES streams(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      message TEXT NOT NULL,
      author TEXT NOT NULL,
      files_changed INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE CASCADE,
      UNIQUE (stream_id, commit_hash)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS stream_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS summary_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id TEXT NOT NULL,
      stream_number TEXT NOT NULL,
      stream_title TEXT NOT NULL,
      stream_category TEXT NOT NULL,
      stream_branch TEXT NOT NULL,
      stream_worktree_path TEXT NOT NULL,
      stream_created_at TEXT NOT NULL,
      stream_completed_at TEXT,
      user_summary TEXT NOT NULL,
      history_file_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    )
  `);

  // Add last_file_change column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE streams ADD COLUMN last_file_change TEXT`);
  } catch {
    // Column already exists, ignore
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
    CREATE INDEX IF NOT EXISTS idx_streams_updated_at ON streams(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_streams_last_file_change ON streams(last_file_change DESC);
    CREATE INDEX IF NOT EXISTS idx_commits_stream_id ON commits(stream_id);
    CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_history_stream_id ON stream_history(stream_id);
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON stream_history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_summary_jobs_status ON summary_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_summary_jobs_created ON summary_jobs(created_at DESC);
  `);
}
