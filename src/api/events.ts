/**
 * Server-Sent Events (SSE) Manager
 *
 * Broadcasts data updates to connected dashboard clients.
 */

import type { Response } from 'express';

export type EventType = 'streams' | 'commits' | 'stats' | 'all' | 'connected' | 'heartbeat';

interface SSEClient {
  id: string;
  res: Response;
  connectedAt: Date;
}

class EventManager {
  private clients: Map<string, SSEClient> = new Map();
  private clientIdCounter = 0;

  addClient(res: Response): string {
    const id = `client-${++this.clientIdCounter}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.clients.set(id, {
      id,
      res,
      connectedAt: new Date(),
    });

    this.sendToClient(id, 'connected', { clientId: id, timestamp: new Date().toISOString() });

    const heartbeat = setInterval(() => {
      if (this.clients.has(id)) {
        this.sendToClient(id, 'heartbeat', {
          timestamp: new Date().toISOString(),
          clients: this.clients.size,
        });
      } else {
        clearInterval(heartbeat);
      }
    }, 30_000);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.clients.delete(id);
      console.error(`[SSE] Client ${id} disconnected (${this.clients.size} remaining)`);
    });

    console.error(`[SSE] Client ${id} connected (${this.clients.size} total)`);
    return id;
  }

  private sendToClient(clientId: string, event: string, data: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (error) {
      console.error(`[SSE] Failed to send to client ${clientId}:`, error);
      this.clients.delete(clientId);
      return false;
    }
  }

  broadcast(event: EventType, data: unknown): number {
    let sent = 0;
    for (const [clientId] of this.clients) {
      if (this.sendToClient(clientId, event, data)) {
        sent++;
      }
    }
    if (sent > 0) {
      console.error(`[SSE] Broadcast '${event}' to ${sent} client(s)`);
    }
    return sent;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const eventManager = new EventManager();

export function notifyUpdate(type: EventType = 'all'): void {
  const timestamp = new Date().toISOString();
  eventManager.broadcast(type, { type, timestamp });
}
