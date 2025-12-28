/**
 * Stream Retirement Service
 *
 * Handles complete stream retirement including:
 * - Worktree cleanup
 * - Archive report generation
 * - Planning file cleanup
 * - Database status update
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import type Database from 'better-sqlite3';
import type { Stream } from '../types/index.js';
import { queueSummaryJob } from '../database/queries/summary-jobs.js';

export interface RetirementOptions {
  deleteWorktree?: boolean;
  cleanupPlanFiles?: boolean;
  writeArchive?: boolean;
  queueIntelligentSummary?: boolean;
  db?: Database.Database;
  projectRoot?: string;
  worktreeRoot?: string;
}

export interface RetirementResult {
  success: boolean;
  streamId: string;
  worktreeDeleted: boolean;
  archiveWritten: boolean;
  planFilesCleanedUp: boolean;
  summaryJobQueued: boolean;
  errors: string[];
}

/**
 * Retire a stream with full cleanup
 */
export async function retireStream(
  stream: Stream,
  summary: string,
  options: RetirementOptions = {}
): Promise<RetirementResult> {
  const {
    deleteWorktree = true,
    cleanupPlanFiles = true,
    writeArchive = true,
    queueIntelligentSummary = true,
    db,
    projectRoot = process.cwd(),
    worktreeRoot = join(projectRoot, '../.worktrees'),
  } = options;

  const result: RetirementResult = {
    success: false,
    streamId: stream.id,
    worktreeDeleted: false,
    archiveWritten: false,
    planFilesCleanedUp: false,
    summaryJobQueued: false,
    errors: [],
  };

  const git: SimpleGit = simpleGit(projectRoot);
  const worktreePath = join(worktreeRoot, stream.id);

  try {
    let archivePath: string | undefined;
    if (writeArchive) {
      try {
        archivePath = await writeArchiveReport(projectRoot, stream, summary, git);
        result.archiveWritten = true;
        console.log(`[retirement] Archive written: ${basename(archivePath)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Archive write failed: ${message}`);
        console.error(`[retirement] Archive write failed:`, error);
      }
    }

    if (queueIntelligentSummary && db && archivePath) {
      try {
        const jobId = queueSummaryJob(db, stream, summary, archivePath);
        result.summaryJobQueued = true;
        console.log(`[retirement] Queued summary job #${jobId} for ${stream.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to queue summary job: ${message}`);
        console.error(`[retirement] Failed to queue summary job:`, error);
      }
    }

    if (deleteWorktree && existsSync(worktreePath)) {
      try {
        console.log(`[retirement] Removing worktree: ${stream.id}`);

        try {
          await git.raw(['worktree', 'remove', worktreePath, '--force']);
          result.worktreeDeleted = true;
        } catch {
          console.log(`[retirement] Git worktree remove failed, trying manual cleanup...`);
          rmSync(worktreePath, { recursive: true, force: true });
          await git.raw(['worktree', 'prune']);
          result.worktreeDeleted = true;
        }

        try {
          await git.branch(['-d', stream.branch]);
          console.log(`[retirement] Local branch deleted: ${stream.branch}`);
        } catch {
          console.log(`[retirement] Could not delete branch (may not exist or is current)`);
        }

        console.log(`[retirement] Worktree deleted successfully`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Worktree deletion failed: ${message}`);
        console.error(`[retirement] Worktree deletion failed:`, error);
      }
    } else if (!existsSync(worktreePath)) {
      result.worktreeDeleted = true;
      console.log(`[retirement] Worktree already removed`);
    }

    if (cleanupPlanFiles) {
      try {
        const planDir = join(projectRoot, '.project/plan/streams', stream.id);
        const planFile = join(projectRoot, '.project/plan/streams', `${stream.id}.md`);

        let cleaned = false;

        if (existsSync(planDir)) {
          console.log(`[retirement] Removing planning directory...`);
          await git.rm(['-rf', planDir]);
          cleaned = true;
        }

        if (existsSync(planFile)) {
          console.log(`[retirement] Removing planning file...`);
          await git.rm([planFile]);
          cleaned = true;
        }

        if (cleaned) {
          await git.commit(`chore: Clean up ${stream.id} planning files`, ['--no-verify']);
          await git.push('origin', 'main');
          result.planFilesCleanedUp = true;
          console.log(`[retirement] Planning files cleaned up`);
        } else {
          result.planFilesCleanedUp = true;
          console.log(`[retirement] No planning files to clean up`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Plan files cleanup failed: ${message}`);
        console.error(`[retirement] Plan files cleanup failed:`, error);
      }
    }

    result.success = result.errors.length === 0;

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Retirement failed: ${message}`);
    console.error(`[retirement] Critical failure:`, error);
    return result;
  }
}

async function writeArchiveReport(
  projectRoot: string,
  stream: Stream,
  summary: string,
  git: SimpleGit
): Promise<string> {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const archiveFilename = `${date}_${stream.id}-RETIRED.md`;
  const archivePath = join(projectRoot, '.project/history', archiveFilename);

  const historyDir = join(projectRoot, '.project/history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  let mergeCommitHash: string | undefined;
  try {
    const log = await git.log({ maxCount: 20 });
    const mergeCommit = log.all.find(
      (c) => c.message.includes(stream.id) || c.refs.includes(stream.id)
    );
    mergeCommitHash = mergeCommit?.hash;
  } catch {
    // Ignore - commit lookup is best-effort
  }

  const archiveContent = generateArchiveReport(stream, summary, mergeCommitHash);
  writeFileSync(archivePath, archiveContent);

  await git.add(archivePath);
  await git.commit(`docs: Archive retired stream ${stream.id}`, ['--no-verify']);
  await git.push('origin', 'main');

  return archivePath;
}

function generateArchiveReport(
  stream: Stream,
  summary: string,
  mergeCommitHash?: string
): string {
  const date = new Date().toISOString().split('T')[0];

  return `# Stream Retired: ${stream.id}

**Date**: ${date}
**Stream**: ${stream.streamNumber} - ${stream.title}
**Branch**: ${stream.branch}
**Category**: ${stream.category}
**Priority**: ${stream.priority}
**Status**: Retired

---

## Summary

${summary}

## Stream Details

- **Created**: ${stream.createdAt}
- **Completed**: ${stream.completedAt || 'N/A'}
- **Worktree Path**: ${stream.worktreePath}

## Merge Details

- **Merge Commit**: ${mergeCommitHash || 'N/A'}
- **Merge Type**: Fast-forward
- **Conflicts**: Resolved in worktree (if any)

---

**Retired by**: Stream Status Dashboard
**Archived**: ${new Date().toISOString()}
`;
}
