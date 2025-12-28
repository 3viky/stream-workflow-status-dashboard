/**
 * HTTP Client for Stream Workflow Status API
 *
 * Provides a typed client for all REST API endpoints.
 * Designed for use from MCP servers, CLI tools, or other Node.js applications.
 */

import type {
  Stream,
  StreamWithActivity,
  Commit,
  QuickStats,
  StreamStatus,
  UpdateStreamParams,
} from '../types/index.js';

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
}

export interface StreamListResponse {
  streams: StreamWithActivity[];
  total: number;
}

export interface CommitListResponse {
  commits: Commit[];
  total: number;
  limit: number;
  offset: number;
}

export interface UpdateStreamResponse {
  success: boolean;
  stream: Stream;
  changes: {
    status?: { from: StreamStatus; to: StreamStatus };
    progress?: number;
  };
}

export interface RetireStreamResponse {
  success: boolean;
  message: string;
  streamId: string;
  deleted: boolean;
  retirement: {
    worktreeDeleted: boolean;
    archiveWritten: boolean;
    planFilesCleanedUp: boolean;
    errors?: string[];
  };
}

export interface BulkRetireResponse {
  success: boolean;
  message: string;
  results: Array<{
    streamId: string;
    success: boolean;
    deleted?: boolean;
    error?: string;
    retirement?: {
      worktreeDeleted: boolean;
      archiveWritten: boolean;
      planFilesCleanedUp: boolean;
    };
  }>;
}

export interface ReconciliationStatus {
  timestamp: string;
  dryRun: boolean;
  staleStreams: Array<{ streamId: string; status: StreamStatus }>;
  completedStreams: Array<{ streamId: string; branch: string }>;
  orphanedWorktrees: Array<{ path: string; branch: string }>;
  actionsNeeded: number;
}

export interface WorktreeListResponse {
  timestamp: string;
  total: number;
  worktrees: Array<{
    id: string;
    path: string;
    branch: string;
    head: string;
    detached: boolean;
  }>;
}

export interface MergedBranchesResponse {
  timestamp: string;
  total: number;
  branches: string[];
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  projectName: string;
}

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

/**
 * HTTP Client for Stream Workflow Status API
 */
export class StreamStatusHttpClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string; details?: string };
        throw new HttpClientError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.details
        );
      }

      return await response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Health check
  async health(): Promise<HealthResponse> {
    return this.request('GET', '/api/health');
  }

  // Streams
  async listStreams(filters?: {
    status?: StreamStatus;
    category?: string;
    priority?: string;
  }): Promise<StreamListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.priority) params.set('priority', filters.priority);

    const query = params.toString();
    return this.request('GET', `/api/streams${query ? `?${query}` : ''}`);
  }

  async getStream(streamId: string): Promise<Stream> {
    return this.request('GET', `/api/streams/${encodeURIComponent(streamId)}`);
  }

  async updateStream(
    streamId: string,
    updates: Partial<Pick<UpdateStreamParams, 'status' | 'progress' | 'blockedBy'>>
  ): Promise<UpdateStreamResponse> {
    return this.request(
      'PATCH',
      `/api/streams/${encodeURIComponent(streamId)}`,
      updates
    );
  }

  async retireStream(
    streamId: string,
    options?: {
      summary?: string;
      deleteWorktree?: boolean;
      cleanupPlanFiles?: boolean;
    }
  ): Promise<RetireStreamResponse> {
    return this.request(
      'POST',
      `/api/streams/${encodeURIComponent(streamId)}/archive`,
      options
    );
  }

  async retireStreamsBulk(
    streamIds: string[],
    options?: {
      summary?: string;
      deleteWorktree?: boolean;
      cleanupPlanFiles?: boolean;
    }
  ): Promise<BulkRetireResponse> {
    return this.request('POST', '/api/streams/archive-bulk', {
      streamIds,
      ...options,
    });
  }

  // Commits
  async listCommits(options?: {
    streamId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CommitListResponse> {
    const params = new URLSearchParams();
    if (options?.streamId) params.set('streamId', options.streamId);
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));

    const query = params.toString();
    return this.request('GET', `/api/commits${query ? `?${query}` : ''}`);
  }

  // Stats
  async getStats(): Promise<QuickStats> {
    return this.request('GET', '/api/stats');
  }

  // Reconciliation
  async getReconciliationStatus(): Promise<ReconciliationStatus> {
    return this.request('GET', '/api/reconciliation/status');
  }

  async runReconciliation(options?: {
    dryRun?: boolean;
    autoArchiveStale?: boolean;
  }): Promise<ReconciliationStatus> {
    return this.request('POST', '/api/reconciliation/run', options);
  }

  async listWorktrees(): Promise<WorktreeListResponse> {
    return this.request('GET', '/api/reconciliation/worktrees');
  }

  async listMergedBranches(): Promise<MergedBranchesResponse> {
    return this.request('GET', '/api/reconciliation/merged');
  }
}

/**
 * Create an HTTP client for the Stream Workflow Status API
 */
export function createHttpClient(baseUrl: string, options?: { timeout?: number }): StreamStatusHttpClient {
  return new StreamStatusHttpClient({
    baseUrl,
    timeout: options?.timeout,
  });
}
