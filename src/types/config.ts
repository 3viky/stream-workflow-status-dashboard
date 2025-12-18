/**
 * Configuration type definitions
 */

export interface Config {
  PROJECT_ROOT: string;
  PROJECT_NAME: string;
  WORKTREE_ROOT: string;
  DATABASE_PATH: string;
  LOCK_FILE_PATH: string;
  API_PORT?: number;
  API_ENABLED: boolean;
}

export interface ApiServerConfig {
  projectRoot: string;
  projectName: string;
  worktreeRoot: string;
  lockFilePath: string;
  databasePath: string;
  port?: number;
  dashboardPath?: string;
}

export interface ServerInfo {
  port: number;
  existing: boolean;
}

export interface ServerLock {
  pid: number;
  port: number;
  projectRoot: string;
  projectName: string;
  startedAt: string;
  nodeVersion: string;
}

export interface DiscoveryResult {
  port: number;
  existing: boolean;
  lock?: ServerLock;
}
