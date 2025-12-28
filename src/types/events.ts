/**
 * SSE Event type definitions
 */

export type EventType = 'streams' | 'commits' | 'stats' | 'all' | 'connected' | 'heartbeat';

export interface SSEEvent {
  type: EventType;
  timestamp: string;
  data?: unknown;
}

export interface SSEClientOptions {
  baseUrl: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
