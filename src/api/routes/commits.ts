/**
 * Commits API routes
 */

import { Router, type Router as RouterType } from 'express';
import type Database from 'better-sqlite3';
import { getRecentCommits, getStreamCommits, addCommit } from '../../database/queries/commits.js';
import { getStream } from '../../database/queries/streams.js';
import { notifyUpdate } from '../events.js';

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

  router.post('/', (req, res) => {
    try {
      const { streamId, commitHash, message, author, filesChanged, timestamp } = req.body;

      // Validate required fields
      if (!streamId || !commitHash || !message || !author || filesChanged === undefined) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'streamId, commitHash, message, author, and filesChanged are required',
        });
      }

      // Verify stream exists
      const stream = getStream(db, streamId);
      if (!stream) {
        return res.status(404).json({
          error: 'Stream not found',
          details: `Stream ${streamId} does not exist in database`,
        });
      }

      // Add commit
      const id = addCommit(db, {
        streamId,
        commitHash,
        message,
        author,
        filesChanged: parseInt(filesChanged, 10),
        timestamp: timestamp || new Date().toISOString(),
      });

      // Notify dashboard of new commit via SSE
      notifyUpdate('commits');

      res.status(201).json({
        success: true,
        id,
        message: 'Commit added successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to add commit', details: errorMessage });
    }
  });

  return router;
}
