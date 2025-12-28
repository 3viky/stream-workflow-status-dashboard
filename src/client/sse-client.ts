/**
 * SSE Client for Stream Workflow Status Real-time Updates
 *
 * Provides a typed client for Server-Sent Events subscription.
 * Handles reconnection and event parsing.
 */

import type { EventType, SSEEvent, SSEClientOptions } from '../types/index.js';

export interface SSEClientConfig {
  baseUrl: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export type SSEEventHandler = (event: SSEEvent) => void;
export type SSEErrorHandler = (error: Error) => void;
export type SSEConnectHandler = () => void;

/**
 * SSE Client for real-time stream status updates
 */
export class StreamStatusSSEClient {
  private readonly baseUrl: string;
  private readonly reconnectDelay: number;
  private readonly maxReconnectAttempts: number;

  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private handlers: Map<string, Set<SSEEventHandler>> = new Map();
  private errorHandlers: Set<SSEErrorHandler> = new Set();
  private connectHandlers: Set<SSEConnectHandler> = new Set();
  private disconnectHandlers: Set<SSEConnectHandler> = new Set();

  constructor(config: SSEClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.reconnectDelay = config.reconnectDelay ?? 3000;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      this.eventSource = new EventSource(`${this.baseUrl}/api/events`);

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.connectHandlers.forEach((handler) => handler());
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          this.emit(data.type, data);
          this.emit('*', data); // Wildcard handlers
        } catch (error) {
          console.error('[SSE] Failed to parse event:', error);
        }
      };

      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.eventSource = null;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.reconnectDelay);
        } else {
          const error = new Error(
            `SSE connection failed after ${this.maxReconnectAttempts} attempts`
          );
          this.errorHandlers.forEach((handler) => handler(error));
        }
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errorHandlers.forEach((handler) => handler(err));
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.disconnectHandlers.forEach((handler) => handler());
    }
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Subscribe to a specific event type
   */
  on(eventType: EventType | '*', handler: SSEEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: SSEEventHandler): () => void {
    return this.on('*', handler);
  }

  /**
   * Subscribe to connection events
   */
  onConnect(handler: SSEConnectHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /**
   * Subscribe to disconnection events
   */
  onDisconnect(handler: SSEConnectHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /**
   * Subscribe to error events
   */
  onError(handler: SSEErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Remove all handlers and disconnect
   */
  destroy(): void {
    this.disconnect();
    this.handlers.clear();
    this.errorHandlers.clear();
    this.connectHandlers.clear();
    this.disconnectHandlers.clear();
  }

  private emit(eventType: string, event: SSEEvent): void {
    this.handlers.get(eventType)?.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('[SSE] Handler error:', error);
      }
    });
  }
}

/**
 * Create an SSE client for real-time updates
 */
export function createSSEClient(
  baseUrl: string,
  options?: Partial<SSEClientConfig>
): StreamStatusSSEClient {
  return new StreamStatusSSEClient({
    baseUrl,
    ...options,
  });
}

/**
 * Node.js-compatible SSE client using fetch
 *
 * Use this when EventSource is not available (Node.js without polyfill)
 */
export class NodeSSEClient {
  private readonly baseUrl: string;
  private readonly reconnectDelay: number;
  private readonly maxReconnectAttempts: number;

  private abortController: AbortController | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private handlers: Map<string, Set<SSEEventHandler>> = new Map();
  private errorHandlers: Set<SSEErrorHandler> = new Set();
  private connectHandlers: Set<SSEConnectHandler> = new Set();
  private disconnectHandlers: Set<SSEConnectHandler> = new Set();

  constructor(config: SSEClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.reconnectDelay = config.reconnectDelay ?? 3000;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
  }

  /**
   * Connect to the SSE endpoint using fetch
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.baseUrl}/api/events`, {
        headers: { Accept: 'text/event-stream' },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response has no body');
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectHandlers.forEach((handler) => handler());

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processChunk = async (): Promise<void> => {
        try {
          const { done, value } = await reader.read();

          if (done) {
            this.handleDisconnect();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as SSEEvent;
                this.emit(data.type, data);
                this.emit('*', data);
              } catch {
                // Ignore parse errors
              }
            }
          }

          processChunk();
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            this.handleDisconnect();
          }
        }
      };

      processChunk();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.handleDisconnect();
      }
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.disconnectHandlers.forEach((handler) => handler());

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      const error = new Error(
        `SSE connection failed after ${this.maxReconnectAttempts} attempts`
      );
      this.errorHandlers.forEach((handler) => handler(error));
    }
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  on(eventType: EventType | '*', handler: SSEEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  onAll(handler: SSEEventHandler): () => void {
    return this.on('*', handler);
  }

  onConnect(handler: SSEConnectHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: SSEConnectHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  onError(handler: SSEErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  destroy(): void {
    this.disconnect();
    this.handlers.clear();
    this.errorHandlers.clear();
    this.connectHandlers.clear();
    this.disconnectHandlers.clear();
  }

  private emit(eventType: string, event: SSEEvent): void {
    this.handlers.get(eventType)?.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('[SSE] Handler error:', error);
      }
    });
  }
}

/**
 * Create a Node.js-compatible SSE client
 */
export function createNodeSSEClient(
  baseUrl: string,
  options?: Partial<SSEClientConfig>
): NodeSSEClient {
  return new NodeSSEClient({
    baseUrl,
    ...options,
  });
}
