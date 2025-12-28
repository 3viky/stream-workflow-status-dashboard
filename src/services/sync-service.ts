/**
 * Sync Service
 *
 * Syncs streams from .project/plan/streams/ markdown files into database
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import type Database from 'better-sqlite3';
import type { Stream, StreamCategory, StreamPriority, StreamStatus } from '../types/index.js';
import { insertStream } from '../database/queries/streams.js';
import { addHistoryEvent } from '../database/queries/history.js';
import { getWorktreeList, type WorktreeInfo } from '../scanners/worktree-reconciliation.js';

interface StreamMetadata {
  streamId: string;
  streamNumber: string;
  title: string;
  category: StreamCategory;
  priority: StreamPriority;
  status: StreamStatus;
  worktreePath: string;
  branch: string;
  estimatedPhases?: string[];
}

/**
 * Parse stream metadata from markdown file
 */
export function parseStreamMarkdown(
  filePath: string,
  streamId: string,
  worktrees: Map<string, WorktreeInfo>,
  worktreeRoot: string
): StreamMetadata | null {
  try {
    const content = readFileSync(filePath, 'utf-8');

    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const frontmatter: Record<string, string> = {};

    if (frontmatterMatch) {
      const lines = frontmatterMatch[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          frontmatter[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
      }
    }

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = frontmatter.title || (titleMatch ? titleMatch[1] : streamId);

    const numberMatch = streamId.match(/stream-(\d+)/);
    const streamNumber = frontmatter.streamNumber || (numberMatch ? numberMatch[1] : '0000');

    const worktreeInfo = worktrees.get(streamId);
    let worktreePath: string;

    if (worktreeInfo) {
      worktreePath = worktreeInfo.path;
    } else {
      worktreePath = join(worktreeRoot, streamId);
    }

    return {
      streamId,
      streamNumber,
      title,
      category: (frontmatter.category as StreamCategory) || 'backend',
      priority: (frontmatter.priority as StreamPriority) || 'medium',
      status: (frontmatter.status as StreamStatus) || 'active',
      worktreePath,
      branch: frontmatter.branch || streamId,
      estimatedPhases: frontmatter.phases?.split(',').map((p: string) => p.trim()),
    };
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

/**
 * Sync all streams from .project/plan/streams/ directory
 */
export async function syncFromFiles(
  db: Database.Database,
  projectRoot: string,
  worktreeRoot: string
): Promise<{
  synced: number;
  skipped: number;
  errors: number;
  worktreesDiscovered: number;
}> {
  const streamsDir = join(projectRoot, '.project', 'plan', 'streams');

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  const worktrees = getWorktreeList(projectRoot);
  const worktreesDiscovered = worktrees.size - 1;

  try {
    const entries = readdirSync(streamsDir);

    for (const entry of entries) {
      const entryPath = join(streamsDir, entry);
      const stat = statSync(entryPath);

      let streamId: string;
      let markdownPath: string;

      if (stat.isDirectory()) {
        streamId = entry;
        markdownPath = join(entryPath, 'README.md');

        try {
          statSync(markdownPath);
        } catch {
          skipped++;
          continue;
        }
      } else if (entry.endsWith('.md')) {
        streamId = basename(entry, '.md');
        markdownPath = entryPath;
      } else {
        skipped++;
        continue;
      }

      const metadata = parseStreamMarkdown(markdownPath, streamId, worktrees, worktreeRoot);

      if (!metadata) {
        errors++;
        continue;
      }

      try {
        const stream: Stream = {
          id: metadata.streamId,
          streamNumber: metadata.streamNumber,
          title: metadata.title,
          category: metadata.category,
          priority: metadata.priority,
          status: metadata.status,
          progress: 0,
          worktreePath: metadata.worktreePath,
          branch: metadata.branch,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          phases: metadata.estimatedPhases,
        };

        insertStream(db, stream);

        addHistoryEvent(db, {
          streamId: stream.id,
          eventType: 'created',
          timestamp: new Date().toISOString(),
        });

        synced++;
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
          skipped++;
        } else {
          errors++;
          console.error(`Failed to add stream ${streamId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to sync from files:', error);
    throw error;
  }

  return { synced, skipped, errors, worktreesDiscovered };
}
