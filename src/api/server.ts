/**
 * Express API Server for Stream Workflow Status
 *
 * Implements multi-agent coordination:
 * - Discovers existing API servers via lock files
 * - Reuses existing servers for the same project
 * - Only starts new server if none exists
 * - Cleans up lock files on shutdown
 *
 * Designed to accept configuration as parameters rather than environment variables.
 */

import express, { type Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { ApiServerConfig, ServerInfo, ServerLock } from '../types/index.js';
import { createStreamsRouter } from './routes/streams.js';
import { createCommitsRouter } from './routes/commits.js';
import { createStatsRouter } from './routes/stats.js';
import { createReconciliationRouter } from './routes/reconciliation.js';
import {
  discoverApiServer,
  writeLockFile,
  setupGracefulShutdown,
} from './discovery.js';
import { eventManager, notifyUpdate } from './events.js';
import { scanAllWorktreeCommits } from '../scanners/git-commits.js';

const SCAN_INTERVAL_MS = 60_000; // 1 minute
let scanningInterval: NodeJS.Timeout | null = null;

/**
 * Create the Express application with all routes configured
 */
export function createApp(db: Database.Database, config: ApiServerConfig): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api/streams', createStreamsRouter(db, config));
  app.use('/api/commits', createCommitsRouter(db));
  app.use('/api/stats', createStatsRouter(db));
  app.use('/api/reconciliation', createReconciliationRouter(db, config));

  // SSE endpoint for real-time updates
  app.get('/api/events', (req, res) => {
    eventManager.addClient(res);
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      projectName: config.projectName,
    });
  });

  // Serve dashboard UI (static files)
  if (config.dashboardPath) {
    app.use(express.static(config.dashboardPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(config.dashboardPath!, 'index.html'));
    });
  }

  return app;
}

/**
 * Start periodic git commit scanning
 * Scans every 60 seconds and notifies connected clients of new data
 */
function startPeriodicScanning(db: Database.Database, projectRoot: string): void {
  if (scanningInterval) {
    clearInterval(scanningInterval);
  }

  console.error(`[Scanner] Starting periodic git scan (every ${SCAN_INTERVAL_MS / 1000}s)`);

  scanningInterval = setInterval(async () => {
    try {
      const result = await scanAllWorktreeCommits(db, projectRoot);

      // Only notify if new commits were added
      if (result.commitsAdded > 0) {
        console.error(`[Scanner] Found ${result.commitsAdded} new commits`);
        notifyUpdate('commits');
        notifyUpdate('stats');
      }
    } catch (error) {
      console.error('[Scanner] Periodic scan failed:', error);
    }
  }, SCAN_INTERVAL_MS);

  // Don't prevent process exit
  scanningInterval.unref();
}

/**
 * Stop periodic scanning
 */
export function stopPeriodicScanning(): void {
  if (scanningInterval) {
    clearInterval(scanningInterval);
    scanningInterval = null;
    console.error('[Scanner] Periodic scanning stopped');
  }
}

/**
 * Start the API server with multi-agent coordination
 *
 * Discovers if a server is already running for this project.
 * If found, returns existing server info without starting a new one.
 * If not found, starts new server and writes lock file.
 *
 * @param db - Database instance
 * @param config - Server configuration
 * @returns Server information (port, existing flag)
 */
export async function startApiServer(
  db: Database.Database,
  config: ApiServerConfig
): Promise<ServerInfo> {
  // Discover if server already exists for this project
  const discovery = await discoverApiServer(
    config.lockFilePath,
    config.projectRoot,
    config.projectName
  );

  if (discovery.existing) {
    // Server already running, reuse it
    console.error(
      `[Server] Reusing existing server for ${config.projectName} on port ${discovery.port}`
    );
    console.error(`[Server] Dashboard: http://localhost:${discovery.port}/`);
    return { port: discovery.port, existing: true };
  }

  // No existing server, start new one
  const port = discovery.port;
  const app = createApp(db, config);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      printServerBanner(config, port);

      // Write lock file
      const lock: ServerLock = {
        pid: process.pid,
        port,
        projectRoot: config.projectRoot,
        projectName: config.projectName,
        startedAt: new Date().toISOString(),
        nodeVersion: process.version,
      };

      try {
        writeLockFile(config.lockFilePath, lock);
        console.error(`[Server] Lock file written: ${config.lockFilePath}`);
      } catch (error) {
        console.error('[Server] Failed to write lock file:', error);
      }

      // Setup graceful shutdown
      setupGracefulShutdown(config.lockFilePath);

      // Start periodic git scanning
      startPeriodicScanning(db, config.projectRoot);

      resolve({ port, existing: false });
    });

    server.on('error', (error) => {
      console.error('[Server] Failed to start:', error);
      reject(error);
    });
  });
}

/**
 * Print server startup banner
 */
function printServerBanner(config: ApiServerConfig, port: number): void {
  console.error(`\n${'='.repeat(60)}`);
  console.error('Stream Workflow Status API Server');
  console.error(`${'='.repeat(60)}\n`);
  console.error(`Project:        ${config.projectName}`);
  console.error(`Dashboard:      http://localhost:${port}/`);
  console.error(`API Endpoints:  http://localhost:${port}/api/`);
  console.error(`Database:       ${config.databasePath}`);
  console.error(`Lock File:      ${config.lockFilePath}`);
  console.error(`\nAvailable Routes:`);
  console.error(`  GET  /api/streams              List all streams`);
  console.error(`  GET  /api/streams/:id          Get single stream`);
  console.error(`  PATCH /api/streams/:id         Update stream status`);
  console.error(`  POST /api/streams/:id/archive  Archive single stream`);
  console.error(`  POST /api/streams/archive-bulk Archive multiple streams`);
  console.error(`  GET  /api/commits              Get recent commits`);
  console.error(`  GET  /api/stats                Get statistics`);
  console.error(`  GET  /api/reconciliation/status  Compare DB vs worktrees`);
  console.error(`  POST /api/reconciliation/run     Run reconciliation`);
  console.error(`  GET  /api/events               SSE real-time updates`);
  console.error(`  GET  /api/health               Health check`);
  console.error(`\n${'='.repeat(60)}\n`);
}
