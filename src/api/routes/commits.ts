/**
 * Commits API routes
 */

import { Router, type Router as RouterType } from 'express';
import type Database from 'better-sqlite3';
import { getRecentCommits, getStreamCommits } from '../../database/queries/commits.js';

export function createCommitsRouter(db: Database.Database): RouterType {
  const router: RouterType = Router();

  router.get('/', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const streamId = req.query.streamId as string;

      const commits = streamId
        ? getStreamCommits(db, streamId, limit)
        : getRecentCommits(db, limit, offset);

      res.json({
        commits,
        total: commits.length,
        limit,
        offset,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to fetch commits', details: errorMessage });
    }
  });

  return router;
}
