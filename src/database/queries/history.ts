/**
 * Stream history tracking operations
 */
import type Database from 'better-sqlite3';
import type { StreamHistoryEvent } from '../../types/index.js';
import { DatabaseError } from '../errors.js';

/**
 * Add a history event for a stream
 */
export function addHistoryEvent(db: Database.Database, event: StreamHistoryEvent): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO stream_history (
        stream_id, event_type, old_value, new_value, timestamp
      ) VALUES (
        @streamId, @eventType, @oldValue, @newValue, @timestamp
      )
    `);

    stmt.run({
      streamId: event.streamId,
      eventType: event.eventType,
      oldValue: event.oldValue ?? null,
      newValue: event.newValue ?? null,
      timestamp: event.timestamp,
    });
  } catch (error) {
    throw new DatabaseError(
      `Failed to add history event for stream ${event.streamId}`,
      'addHistoryEvent',
      error
    );
  }
}

/**
 * Get history events for a specific stream
 */
export function getStreamHistory(db: Database.Database, streamId: string): StreamHistoryEvent[] {
  try {
    const stmt = db.prepare(`
      SELECT * FROM stream_history
      WHERE stream_id = ?
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(streamId) as Record<string, unknown>[];
    return rows.map(rowToHistoryEvent);
  } catch (error) {
    throw new DatabaseError(
      `Failed to get history for stream ${streamId}`,
      'getStreamHistory',
      error
    );
  }
}

function rowToHistoryEvent(row: Record<string, unknown>): StreamHistoryEvent {
  return {
    id: row.id as number,
    streamId: row.stream_id as string,
    eventType: row.event_type as StreamHistoryEvent['eventType'],
    oldValue: row.old_value as string | undefined,
    newValue: row.new_value as string | undefined,
    timestamp: row.timestamp as string,
  };
}
