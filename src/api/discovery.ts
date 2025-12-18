/**
 * Server Discovery and Lock Management
 *
 * Implements multi-agent, per-project server coordination.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import http from 'http';
import type { ServerLock, DiscoveryResult } from '../types/index.js';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function testServer(url: string, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;

    const available = await new Promise<boolean>((resolve) => {
      const server = http.createServer();

      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });

    if (available) {
      return port;
    }
  }

  throw new Error(`No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

function readLockFile(lockFilePath: string): ServerLock | null {
  try {
    if (!existsSync(lockFilePath)) {
      return null;
    }

    const content = readFileSync(lockFilePath, 'utf-8');
    return JSON.parse(content) as ServerLock;
  } catch (error) {
    console.error('Failed to read lock file:', error);
    return null;
  }
}

export function writeLockFile(lockFilePath: string, lock: ServerLock): void {
  try {
    const dir = join(lockFilePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(lockFilePath, JSON.stringify(lock, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write lock file:', error);
    throw error;
  }
}

export function removeLockFile(lockFilePath: string): void {
  try {
    if (existsSync(lockFilePath)) {
      unlinkSync(lockFilePath);
    }
  } catch (error) {
    console.error('Failed to remove lock file:', error);
  }
}

export async function discoverApiServer(
  lockFilePath: string,
  projectRoot: string,
  projectName: string
): Promise<DiscoveryResult> {
  const lock = readLockFile(lockFilePath);

  if (lock) {
    if (isProcessAlive(lock.pid)) {
      const isResponding = await testServer(`http://localhost:${lock.port}/api/stats`);

      if (isResponding) {
        console.error(
          `[Discovery] Found existing server for ${projectName} on port ${lock.port} (PID: ${lock.pid})`
        );
        return {
          port: lock.port,
          existing: true,
          lock,
        };
      }

      console.error(
        `[Discovery] Server on port ${lock.port} not responding, cleaning up stale lock`
      );
    } else {
      console.error(`[Discovery] Process ${lock.pid} is dead, cleaning up stale lock`);
    }

    removeLockFile(lockFilePath);
  }

  const port = await findAvailablePort(3001);

  console.error(`[Discovery] No existing server found, will use port ${port}`);

  return {
    port,
    existing: false,
  };
}

export function setupGracefulShutdown(lockFilePath: string): void {
  const cleanup = () => {
    console.error('[Shutdown] Cleaning up server lock...');
    removeLockFile(lockFilePath);
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    removeLockFile(lockFilePath);
  });
}
