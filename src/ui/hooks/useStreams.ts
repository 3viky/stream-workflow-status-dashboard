/**
 * Custom hook for fetching and managing stream data
 */

import { useState, useEffect, useCallback } from 'react';
import type { Stream } from '../../types/index.js';
import { useServerEvents } from './useServerEvents';
import { useConnectionStatus } from '../contexts/ConnectionContext';

// Dynamically detect API port from current window location
const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : 'http://localhost:3001/api';

interface UseStreamsResult {
  streams: Stream[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  retireStream: (streamId: string) => Promise<boolean>;
  retireStreams: (streamIds: string[]) => Promise<{ success: boolean; results: any[] }>;
  updateStreamStatus: (streamId: string, status: string) => Promise<boolean>;
}

export function useStreams(): UseStreamsResult {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { markDataReceived, markError: reportError } = useConnectionStatus();

  const fetchStreams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/streams`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStreams(data.streams || []);
      markDataReceived();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch streams');
      reportError();
      console.error('Error fetching streams:', err);
    } finally {
      setLoading(false);
    }
  }, [markDataReceived, reportError]);

  const retireStream = useCallback(async (streamId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/streams/${encodeURIComponent(streamId)}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Stream is DELETED from database after retirement
      // Remove it from local state immediately
      setStreams(prev => prev.filter(s => s.id !== streamId));

      return true;
    } catch (err) {
      console.error('Error retiring stream:', err);
      return false;
    }
  }, []);

  const retireStreams = useCallback(async (streamIds: string[]): Promise<{ success: boolean; results: any[] }> => {
    try {
      const response = await fetch(`${API_BASE}/streams/archive-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Streams are DELETED from database after retirement
      // Remove successfully retired streams from local state
      const retiredIds = new Set(
        data.results
          .filter((r: any) => r.success && r.deleted)
          .map((r: any) => r.streamId)
      );

      setStreams(prev => prev.filter(s => !retiredIds.has(s.id)));

      return data;
    } catch (err) {
      console.error('Error retiring streams:', err);
      return { success: false, results: [] };
    }
  }, []);

  const updateStreamStatus = useCallback(async (streamId: string, status: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/streams/${encodeURIComponent(streamId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update local state
      setStreams(prev => prev.map(s =>
        s.id === streamId ? { ...s, status: status as Stream['status'] } : s
      ));

      return true;
    } catch (err) {
      console.error('Error updating stream status:', err);
      return false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  // Subscribe to SSE updates (replaces polling)
  useServerEvents('streams', fetchStreams);

  return {
    streams,
    loading,
    error,
    refetch: fetchStreams,
    retireStream,
    retireStreams,
    updateStreamStatus,
  };
}
