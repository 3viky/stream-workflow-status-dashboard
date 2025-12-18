/**
 * Stream history event type definitions
 */

export type HistoryEventType = 'created' | 'status_changed' | 'progress_updated' | 'completed' | 'archived';

export interface StreamHistoryEvent {
  id?: number;
  streamId: string;
  eventType: HistoryEventType;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}
