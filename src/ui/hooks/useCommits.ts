/**
 * Custom hook for fetching and managing commit data
 * Supports infinite scroll with offset-based pagination
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Commit } from '../../types/index.js';
import { useServerEvents } from './useServerEvents';
import { useConnectionStatus } from '../contexts/ConnectionContext';

// Dynamically detect API port from current window location
const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : 'http://localhost:3001/api';

interface UseCommitsResult {
  commits: Commit[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  refetch: () => void;
  loadMore: () => void;
}

const PAGE_SIZE = 50;

export function useCommits(initialLimit?: number): UseCommitsResult {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const { markDataReceived, markError: reportError } = useConnectionStatus();

  const fetchCommits = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        offsetRef.current = 0;
      }
      setError(null);

      const limit = initialLimit || PAGE_SIZE;
      const offset = append ? offsetRef.current : 0;
      const url = `${API_BASE}/commits?limit=${limit}&offset=${offset}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const newCommits = data.commits || [];

      if (append) {
        setCommits(prev => [...prev, ...newCommits]);
        offsetRef.current += newCommits.length;
      } else {
        setCommits(newCommits);
        offsetRef.current = newCommits.length;
      }

      // Check if there are more commits to load
      setHasMore(newCommits.length >= limit);
      markDataReceived();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch commits');
      reportError();
      console.error('Error fetching commits:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [initialLimit, markDataReceived, reportError]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchCommits(true);
    }
  }, [fetchCommits, loadingMore, hasMore]);

  // Initial fetch
  useEffect(() => {
    fetchCommits(false);
  }, [fetchCommits]);

  // Subscribe to SSE updates (replaces polling) - only refetch initial page
  useServerEvents('commits', () => fetchCommits(false));

  return { commits, loading, loadingMore, error, hasMore, refetch: () => fetchCommits(false), loadMore };
}
