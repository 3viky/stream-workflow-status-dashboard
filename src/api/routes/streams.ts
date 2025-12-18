/**
 * Streams API routes
 */

import { Router, type Router as RouterType } from 'express';
import type Database from 'better-sqlite3';
import type { StreamStatus, ApiServerConfig } from '../../types/index.js';
import {
  getAllStreams,
  getStream,
  updateStream,
  completeStream,
  deleteStream,
} from '../../database/queries/streams.js';
import { addHistoryEvent } from '../../database/queries/history.js';
import { retireStream } from '../../services/retirement-service.js';

export function createStreamsRouter(db: Database.Database, config: ApiServerConfig): RouterType {
  const router: RouterType = Router();

  router.get('/', (req, res) => {
    try {
      const { status, category, priority } = req.query;

      const streams = getAllStreams(db, {
        status: status as string,
        category: category as string,
      });

      const filtered = priority ? streams.filter((s) => s.priority === priority) : streams;

      res.json({
        streams: filtered,
        total: filtered.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to fetch streams', details: errorMessage });
    }
  });

  router.get('/:id', (req, res) => {
    try {
      const stream = getStream(db, req.params.id);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      res.json(stream);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to fetch stream', details: errorMessage });
    }
  });

  router.patch('/:id', (req, res) => {
    try {
      const stream = getStream(db, req.params.id);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      const { status, progress, blockedBy } = req.body;

      const validStatuses: StreamStatus[] = [
        'initializing',
        'active',
        'blocked',
        'paused',
        'completed',
        'archived',
      ];
      if (status && !validStatuses.includes(status)) {
        return res
          .status(400)
          .json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      if (
        progress !== undefined &&
        (typeof progress !== 'number' || progress < 0 || progress > 100)
      ) {
        return res.status(400).json({ error: 'Progress must be a number between 0 and 100' });
      }

      const previousStatus = stream.status;

      if (status === 'completed' && previousStatus !== 'completed') {
        completeStream(db, req.params.id);
      } else {
        updateStream(db, req.params.id, {
          status: status as StreamStatus,
          progress,
          blockedBy,
        });
      }

      if (status && status !== previousStatus) {
        addHistoryEvent(db, {
          streamId: req.params.id,
          eventType: 'status_changed',
          oldValue: previousStatus,
          newValue: status,
          timestamp: new Date().toISOString(),
        });
      }

      const updatedStream = getStream(db, req.params.id);

      res.json({
        success: true,
        stream: updatedStream,
        changes: {
          status: status !== previousStatus ? { from: previousStatus, to: status } : undefined,
          progress: progress !== undefined ? progress : undefined,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to update stream', details: errorMessage });
    }
  });

  router.post('/:id/archive', async (req, res) => {
    try {
      const stream = getStream(db, req.params.id);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      const previousStatus = stream.status;

      if (previousStatus !== 'completed') {
        return res.status(400).json({
          error: 'Cannot retire stream',
          details: `Stream must be in 'completed' status before retirement. Current status: ${previousStatus}`,
        });
      }

      const {
        summary = 'Stream completed and retired',
        deleteWorktree = true,
        cleanupPlanFiles = true,
      } = req.body || {};

      const retirementResult = await retireStream(stream, summary, {
        deleteWorktree,
        cleanupPlanFiles,
        queueIntelligentSummary: true,
        db,
        projectRoot: config.projectRoot,
        worktreeRoot: config.worktreeRoot,
      });

      addHistoryEvent(db, {
        streamId: req.params.id,
        eventType: 'completed',
        oldValue: previousStatus,
        newValue: 'retired and deleted from database',
        timestamp: new Date().toISOString(),
      });

      deleteStream(db, req.params.id);

      res.json({
        success: retirementResult.success,
        message: retirementResult.success
          ? `Stream ${req.params.id} retired and removed from database`
          : `Stream ${req.params.id} retired with warnings and removed from database`,
        streamId: req.params.id,
        deleted: true,
        retirement: {
          worktreeDeleted: retirementResult.worktreeDeleted,
          archiveWritten: retirementResult.archiveWritten,
          planFilesCleanedUp: retirementResult.planFilesCleanedUp,
          errors: retirementResult.errors,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to retire stream', details: errorMessage });
    }
  });

  router.post('/archive-bulk', async (req, res) => {
    try {
      const {
        streamIds,
        summary = 'Bulk retirement',
        deleteWorktree = true,
        cleanupPlanFiles = true,
      } = req.body;

      if (!Array.isArray(streamIds) || streamIds.length === 0) {
        return res.status(400).json({ error: 'streamIds must be a non-empty array' });
      }

      const results: {
        streamId: string;
        success: boolean;
        deleted?: boolean;
        error?: string;
        retirement?: {
          worktreeDeleted: boolean;
          archiveWritten: boolean;
          planFilesCleanedUp: boolean;
        };
      }[] = [];

      for (const streamId of streamIds) {
        try {
          const stream = getStream(db, streamId);

          if (!stream) {
            results.push({ streamId, success: false, error: 'Not found' });
            continue;
          }

          if (stream.status === 'archived') {
            results.push({ streamId, success: true, error: 'Already retired' });
            continue;
          }

          if (stream.status !== 'completed') {
            results.push({
              streamId,
              success: false,
              error: `Cannot retire: status is '${stream.status}', must be 'completed'`,
            });
            continue;
          }

          const retirementResult = await retireStream(stream, summary, {
            deleteWorktree,
            cleanupPlanFiles,
            queueIntelligentSummary: true,
            db,
            projectRoot: config.projectRoot,
            worktreeRoot: config.worktreeRoot,
          });

          addHistoryEvent(db, {
            streamId,
            eventType: 'completed',
            oldValue: stream.status,
            newValue: 'retired and deleted from database',
            timestamp: new Date().toISOString(),
          });

          deleteStream(db, streamId);

          results.push({
            streamId,
            success: retirementResult.success,
            deleted: true,
            error:
              retirementResult.errors.length > 0
                ? retirementResult.errors.join('; ')
                : undefined,
            retirement: {
              worktreeDeleted: retirementResult.worktreeDeleted,
              archiveWritten: retirementResult.archiveWritten,
              planFilesCleanedUp: retirementResult.planFilesCleanedUp,
            },
          });
        } catch (error) {
          results.push({
            streamId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      res.json({
        success: failCount === 0,
        message: `Retired ${successCount} streams, ${failCount} failed`,
        results,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to retire streams', details: errorMessage });
    }
  });

  return router;
}
