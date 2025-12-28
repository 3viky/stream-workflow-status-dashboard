/**
 * Statistics API routes
 */

import { Router, type Router as RouterType } from 'express';
import type Database from 'better-sqlite3';
import { getQuickStats } from '../../database/queries/stats.js';

export function createStatsRouter(db: Database.Database): RouterType {
  const router: RouterType = Router();

  router.get('/', (req, res) => {
    try {
      const stats = getQuickStats(db);
      res.json(stats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to fetch stats', details: errorMessage });
    }
  });

  return router;
}
