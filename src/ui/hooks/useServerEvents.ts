/**
 * Server-Sent Events (SSE) hook
 *
 * Connects to the server's SSE endpoint and triggers refetch
 * callbacks when data updates are pushed from the server.
 * Replaces polling with push-based updates.
 */

import { useEffect, useRef } from 'react';

type EventType = 'streams' | 'commits' | 'stats' | 'all' | 'connected' | 'heartbeat';

interface EventSubscription {
  type: EventType;
  callback: () => void;
}

// Singleton SSE connection shared across all hooks
let eventSource: EventSource | null = null;
let subscriptions: EventSubscription[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : 'http://localhost:3001/api';

function connectSSE(): void {
  if (eventSource?.readyState === EventSource.OPEN) {
    return; // Already connected
  }

  if (eventSource) {
    eventSource.close();
  }

  console.log('[SSE] Connecting to', `${API_BASE}/events`);
  eventSource = new EventSource(`${API_BASE}/events`);

  eventSource.onopen = () => {
    console.log('[SSE] Connected');
    reconnectAttempts = 0;
  };

  eventSource.onerror = (error) => {
    console.error('[SSE] Connection error:', error);

    if (eventSource?.readyState === EventSource.CLOSED) {
      // Connection closed, attempt reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`[SSE] Reconnecting in ${RECONNECT_DELAY_MS}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(connectSSE, RECONNECT_DELAY_MS);
      } else {
        console.error('[SSE] Max reconnect attempts reached, falling back to polling');
      }
    }
  };

  // Handle update events
  const handleEvent = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const eventType = data.type as EventType;

      // Notify all matching subscriptions
      subscriptions.forEach((sub) => {
        if (sub.type === eventType || sub.type === 'all' || eventType === 'all') {
          sub.callback();
        }
      });
    } catch (error) {
      console.error('[SSE] Failed to parse event:', error);
    }
  };

  eventSource.addEventListener('streams', handleEvent);
  eventSource.addEventListener('commits', handleEvent);
  eventSource.addEventListener('stats', handleEvent);
  eventSource.addEventListener('all', handleEvent);
  eventSource.addEventListener('heartbeat', handleEvent);

  eventSource.addEventListener('connected', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[SSE] Server acknowledged connection:', data.clientId);
      // Notify subscriptions that we're connected (for status tracking)
      subscriptions.forEach((sub) => {
        if (sub.type === 'heartbeat') {
          sub.callback();
        }
      });
    } catch {
      // Ignore parse errors for connected event
    }
  });
}

function disconnectSSE(): void {
  if (subscriptions.length === 0 && eventSource) {
    console.log('[SSE] No more subscriptions, closing connection');
    eventSource.close();
    eventSource = null;
  }
}

/**
 * Subscribe to server-sent events for a specific data type
 *
 * @param type - The event type to subscribe to ('streams', 'commits', 'stats', 'all')
 * @param onUpdate - Callback to invoke when an update is received
 */
export function useServerEvents(type: EventType, onUpdate: () => void): void {
  const callbackRef = useRef(onUpdate);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    // Create subscription with stable reference
    const subscription: EventSubscription = {
      type,
      callback: () => callbackRef.current(),
    };

    subscriptions.push(subscription);

    // Connect if this is the first subscription
    if (subscriptions.length === 1) {
      connectSSE();
    }

    // Cleanup on unmount
    return () => {
      subscriptions = subscriptions.filter((s) => s !== subscription);
      disconnectSSE();
    };
  }, [type]);
}

/**
 * Check if SSE is connected
 */
export function isSSEConnected(): boolean {
  return eventSource?.readyState === EventSource.OPEN;
}
