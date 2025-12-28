/**
 * Git Commit Scanner
 *
 * Scans worktree git logs and populates commits table with recent activity.
 */

import { execSync } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';
import type { Stream, Commit } from '../types/index.js';
import { addCommit as insertCommit } from '../database/queries/commits.js';
import { getAllStreams, updateLastFileChange } from '../database/queries/streams.js';

/**
 * Get last file modification time in a directory (recursive)
 * Performs COMPLETE recursive search through all source files.
 * Skips only build artifacts and version control directories.
 */
function getLastFileModificationTime(dirPath: string): Date | null {
  try {
    if (!existsSync(dirPath)) {
      return null;
    }

    let latestMtime: Date | null = null;

    function walkDir(currentPath: string): void {
      try {
        const entries = readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentPath, entry.name);

          // Skip build artifacts, generated files, and version control - complete search of all SOURCE files
          if (entry.isDirectory() && ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage', '__pycache__', '.pytest_cache', '.mypy_cache', '.turbo', '.vite', 'out'].includes(entry.name)) {
            continue;
          }

          // Skip generated files by extension
          if (entry.isFile() && ['.pyc', '.pyo', '.class', '.o', '.so', '.dylib', '.dll'].some(ext => entry.name.endsWith(ext))) {
            continue;
          }

          try {
            const stats = statSync(fullPath);

            if (entry.isFile()) {
              if (!latestMtime || stats.mtime > latestMtime) {
                latestMtime = stats.mtime;
              }
            } else if (entry.isDirectory()) {
              walkDir(fullPath); // No depth limit - complete search
            }
          } catch {
            // Skip files/dirs we can't stat (permission errors, etc.)
            continue;
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    walkDir(dirPath);
    return latestMtime;
  } catch {
    return null;
  }
}

/**
 * Get git commits from a worktree
 */
export function getWorktreeCommits(stream: Stream): Commit[] {
  try {
    if (!existsSync(stream.worktreePath)) {
      return [];
    }

    const gitLogCommand = `git log main..HEAD --pretty=format:"%H|%an|%aI|%s|" --numstat -n 50`;

    const output = execSync(gitLogCommand, {
      cwd: stream.worktreePath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const commits: Commit[] = [];
    const lines = output.trim().split('\n');
    let currentCommit: Partial<Commit> | null = null;
    let filesChanged = 0;

    for (const line of lines) {
      if (line.includes('|')) {
        if (currentCommit) {
          currentCommit.filesChanged = filesChanged;
          commits.push(currentCommit as Commit);
        }

        const parts = line.split('|');
        if (parts.length >= 4) {
          currentCommit = {
            streamId: stream.id,
            commitHash: parts[0].trim(),
            author: parts[1].trim(),
            timestamp: new Date(parts[2].trim()).toISOString(),
            message: parts[3].trim(),
            filesChanged: 0,
          };
          filesChanged = 0;
        }
      } else if (line.match(/^\d+\s+\d+\s+/) || line.match(/^-\s+-\s+/)) {
        filesChanged++;
      }
    }

    if (currentCommit) {
      currentCommit.filesChanged = filesChanged;
      commits.push(currentCommit as Commit);
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * Get recent commits from main branch
 */
export function getMainBranchCommits(projectRoot: string): Commit[] {
  try {
    const gitLogCommand = `git log main --pretty=format:"%H|%an|%aI|%s|" --numstat --since="7 days ago" -n 20`;

    const output = execSync(gitLogCommand, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const commits: Commit[] = [];
    const lines = output.trim().split('\n');
    let currentCommit: Partial<Commit> | null = null;
    let filesChanged = 0;

    for (const line of lines) {
      if (line.includes('|')) {
        if (currentCommit) {
          currentCommit.filesChanged = filesChanged;
          commits.push(currentCommit as Commit);
        }

        const parts = line.split('|');
        if (parts.length >= 4) {
          currentCommit = {
            streamId: 'main',
            commitHash: parts[0].trim(),
            author: parts[1].trim(),
            timestamp: new Date(parts[2].trim()).toISOString(),
            message: parts[3].trim(),
            filesChanged: 0,
          };
          filesChanged = 0;
        }
      } else if (line.match(/^\d+\s+\d+\s+/) || line.match(/^-\s+-\s+/)) {
        filesChanged++;
      }
    }

    if (currentCommit) {
      currentCommit.filesChanged = filesChanged;
      commits.push(currentCommit as Commit);
    }

    return commits;
  } catch (error) {
    console.error('Failed to get main branch commits:', error);
    return [];
  }
}

/**
 * Scan all worktrees and populate commits table
 */
export async function scanAllWorktreeCommits(
  db: Database.Database,
  projectRoot: string
): Promise<{
  scanned: number;
  commitsAdded: number;
  errors: number;
}> {
  const streams = getAllStreams(db);

  let scanned = 0;
  let commitsAdded = 0;
  let errors = 0;

  // Ensure "main" exists as a special stream
  try {
    const mainExists = db.prepare('SELECT id FROM streams WHERE id = ?').get('main');
    if (!mainExists) {
      db.prepare(
        `
        INSERT INTO streams (id, stream_number, title, category, priority, status, progress, worktree_path, branch, created_at, updated_at)
        VALUES ('main', 'main', 'Main Branch', 'infrastructure', 'high', 'active', 100, ?, 'main', ?, ?)
      `
      ).run(projectRoot, new Date().toISOString(), new Date().toISOString());
    }
  } catch (error) {
    console.error('Failed to create main stream entry:', error);
  }

  // Scan main branch commits
  try {
    const mainCommits = getMainBranchCommits(projectRoot);
    for (const commit of mainCommits) {
      try {
        insertCommit(db, commit);
        commitsAdded++;
      } catch (error) {
        if (error instanceof Error && !error.message.includes('UNIQUE')) {
          errors++;
        }
      }
    }
  } catch (error) {
    console.error('Failed to scan main branch:', error);
  }

  // Scan all stream worktrees
  for (const stream of streams) {
    try {
      scanned++;
      const commits = getWorktreeCommits(stream);

      for (const commit of commits) {
        try {
          insertCommit(db, commit);
          commitsAdded++;
        } catch (error) {
          if (error instanceof Error && !error.message.includes('UNIQUE')) {
            errors++;
            console.error(`Failed to insert commit ${commit.commitHash}:`, error);
          }
        }
      }

      // Update last file modification time
      try {
        const lastModified = getLastFileModificationTime(stream.worktreePath);
        if (lastModified) {
          updateLastFileChange(db, stream.id, lastModified.toISOString());
        }
      } catch (error) {
        console.error(`Failed to update last file change for stream ${stream.id}:`, error);
      }
    } catch (error) {
      errors++;
      console.error(`Failed to scan commits for stream ${stream.id}:`, error);
    }
  }

  return { scanned, commitsAdded, errors };
}

/**
 * Scan commits for a specific stream
 */
export async function scanStreamCommits(
  db: Database.Database,
  streamId: string
): Promise<number> {
  const streams = getAllStreams(db);
  const stream = streams.find((s) => s.id === streamId);

  if (!stream) {
    throw new Error(`Stream not found: ${streamId}`);
  }

  const commits = getWorktreeCommits(stream);
  let added = 0;

  for (const commit of commits) {
    try {
      insertCommit(db, commit);
      added++;
    } catch (error) {
      if (error instanceof Error && !error.message.includes('UNIQUE')) {
        throw error;
      }
    }
  }

  return added;
}
