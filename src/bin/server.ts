#!/usr/bin/env node
/**
 * Standalone Stream Status Server
 *
 * Usage:
 *   stream-status-server [options]
 *
 * Environment variables:
 *   PROJECT_ROOT       - Path to the project root (required)
 *   PROJECT_NAME       - Project name for display (default: basename of PROJECT_ROOT)
 *   WORKTREE_ROOT      - Path to worktrees directory (default: PROJECT_ROOT/.worktrees)
 *   DATABASE_PATH      - Path to SQLite database (default: ~/.stream-status/PROJECT_NAME.db)
 *   LOCK_FILE_PATH     - Path to server lock file (default: ~/.stream-status/PROJECT_NAME.lock)
 *   PORT               - Port to listen on (default: auto-detect starting from 3001)
 *   DASHBOARD_PATH     - Path to static dashboard files (optional)
 *   SYNC_ON_START      - Whether to sync from files on startup (default: true)
 */

import { basename, join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { initializeDatabase } from '../database/client.js';
import { startApiServer } from '../api/server.js';
import { syncFromFiles } from '../services/sync-service.js';
import type { ApiServerConfig } from '../types/index.js';

function getEnvOrDefault(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

async function main(): Promise<void> {
  // Parse configuration from environment
  const projectRoot = getEnvOrDefault('PROJECT_ROOT');

  if (!projectRoot) {
    console.error('Error: PROJECT_ROOT environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  PROJECT_ROOT=/path/to/project stream-status-server');
    console.error('');
    console.error('Environment variables:');
    console.error('  PROJECT_ROOT       - Path to the project root (required)');
    console.error('  PROJECT_NAME       - Project name for display');
    console.error('  WORKTREE_ROOT      - Path to worktrees directory');
    console.error('  DATABASE_PATH      - Path to SQLite database');
    console.error('  LOCK_FILE_PATH     - Path to server lock file');
    console.error('  PORT               - Port to listen on');
    console.error('  DASHBOARD_PATH     - Path to static dashboard files');
    console.error('  SYNC_ON_START      - Whether to sync from files on startup (true/false)');
    process.exit(1);
  }

  const projectName = getEnvOrDefault('PROJECT_NAME', basename(projectRoot))!;
  const worktreeRoot = getEnvOrDefault('WORKTREE_ROOT', join(projectRoot, '.worktrees'))!;

  // Default paths in ~/.stream-status/
  const stateDir = join(homedir(), '.stream-status');
  ensureDirectory(stateDir);

  const databasePath = getEnvOrDefault('DATABASE_PATH', join(stateDir, `${projectName}.db`))!;
  const lockFilePath = getEnvOrDefault('LOCK_FILE_PATH', join(stateDir, `${projectName}.lock`))!;
  const dashboardPath = getEnvOrDefault('DASHBOARD_PATH');
  const portStr = getEnvOrDefault('PORT');
  const syncOnStart = getEnvOrDefault('SYNC_ON_START', 'true') !== 'false';

  console.error('[Startup] Stream Workflow Status Server');
  console.error(`[Config] Project Root: ${projectRoot}`);
  console.error(`[Config] Project Name: ${projectName}`);
  console.error(`[Config] Worktree Root: ${worktreeRoot}`);
  console.error(`[Config] Database: ${databasePath}`);
  console.error(`[Config] Lock File: ${lockFilePath}`);
  if (dashboardPath) {
    console.error(`[Config] Dashboard: ${dashboardPath}`);
  }

  // Initialize database
  console.error('[Startup] Initializing database...');
  const db = initializeDatabase(databasePath);

  // Sync from files if enabled
  if (syncOnStart) {
    console.error('[Startup] Syncing streams from plan files...');
    try {
      const syncResult = await syncFromFiles(db, projectRoot, worktreeRoot);
      console.error(`[Startup] Synced ${syncResult.synced} synced, ${syncResult.skipped} skipped, ${syncResult.errors} errors`);
    } catch (error) {
      console.error('[Startup] Warning: Sync failed:', error);
    }
  }

  // Build server config
  const config: ApiServerConfig = {
    projectRoot,
    projectName,
    worktreeRoot,
    lockFilePath,
    databasePath,
    dashboardPath,
    port: portStr ? parseInt(portStr, 10) : undefined,
  };

  // Start API server
  const serverInfo = await startApiServer(db, config);

  if (serverInfo.existing) {
    console.error(`[Startup] Using existing server on port ${serverInfo.port}`);
    // Exit gracefully - another server is handling requests
    process.exit(0);
  }

  console.error(`[Startup] Server ready on port ${serverInfo.port}`);
}

main().catch((error) => {
  console.error('[Fatal] Server startup failed:', error);
  process.exit(1);
});
