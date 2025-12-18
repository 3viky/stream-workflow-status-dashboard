/**
 * Client SDK for Stream Workflow Status
 *
 * Provides typed clients for consuming the API from external applications:
 * - HTTP Client for REST API operations
 * - SSE Client for real-time updates
 *
 * @example
 * ```typescript
 * import { createHttpClient, createNodeSSEClient } from '@3viky/stream-workflow-status-dashboard/client';
 *
 * const http = createHttpClient('http://localhost:3001');
 * const stats = await http.getStats();
 *
 * const sse = createNodeSSEClient('http://localhost:3001');
 * sse.on('streams', (event) => console.log('Streams updated'));
 * sse.connect();
 * ```
 */

// HTTP Client
export {
  StreamStatusHttpClient,
  createHttpClient,
  HttpClientError,
  type HttpClientConfig,
  type StreamListResponse,
  type CommitListResponse,
  type UpdateStreamResponse,
  type RetireStreamResponse,
  type BulkRetireResponse,
  type ReconciliationStatus,
  type WorktreeListResponse,
  type MergedBranchesResponse,
  type HealthResponse,
} from './http-client.js';

// SSE Clients
export {
  StreamStatusSSEClient,
  createSSEClient,
  NodeSSEClient,
  createNodeSSEClient,
  type SSEClientConfig,
  type SSEEventHandler,
  type SSEErrorHandler,
  type SSEConnectHandler,
} from './sse-client.js';

// Re-export types for convenience
export type {
  Stream,
  StreamWithActivity,
  StreamStatus,
  StreamCategory,
  StreamPriority,
  Commit,
  CommitWithStream,
  QuickStats,
  EventType,
  SSEEvent,
} from '../types/index.js';
