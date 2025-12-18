/**
 * Reconciliation API routes
 */

import { Router, type Router as RouterType } from 'express';
import type Database from 'better-sqlite3';
import type { ApiServerConfig } from '../../types/index.js';
import {
  reconcileWorktrees,
  getWorktreeList,
  getMergedBranches,
} from '../../scanners/worktree-reconciliation.js';

export function createReconciliationRouter(
  db: Database.Database,
  config: ApiServerConfig
): RouterType {
  const router: RouterType = Router();

  router.get('/status', async (req, res) => {
    try {
      const result = await reconcileWorktrees(db, config.projectRoot, { dryRun: true });

      res.json({
        timestamp: new Date().toISOString(),
        dryRun: true,
        ...result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res
        .status(500)
        .json({ error: 'Failed to get reconciliation status', details: errorMessage });
    }
  });

  router.post('/run', async (req, res) => {
    try {
      const { dryRun = true, autoArchiveStale = false } = req.body;

      const result = await reconcileWorktrees(db, config.projectRoot, {
        dryRun,
        autoArchiveStale,
        autoAddOrphaned: false,
      });

      res.json({
        timestamp: new Date().toISOString(),
        dryRun,
        autoArchiveStale,
        ...result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to run reconciliation', details: errorMessage });
    }
  });

  router.get('/worktrees', (req, res) => {
    try {
      const worktrees = getWorktreeList(config.projectRoot);
      const worktreeArray = Array.from(worktrees.entries()).map(([id, info]) => ({
        id,
        ...info,
      }));

      res.json({
        timestamp: new Date().toISOString(),
        total: worktreeArray.length,
        worktrees: worktreeArray,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to get worktree list', details: errorMessage });
    }
  });

  router.get('/merged', (req, res) => {
    try {
      const merged = getMergedBranches(config.projectRoot);
      const mergedArray = Array.from(merged);

      res.json({
        timestamp: new Date().toISOString(),
        total: mergedArray.length,
        branches: mergedArray,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to get merged branches', details: errorMessage });
    }
  });

  return router;
}
