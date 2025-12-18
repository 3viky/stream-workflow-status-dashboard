/**
 * Custom hook for worktree reconciliation
 */

import { useState, useCallback } from 'react';

// Dynamically detect API port from current window location
const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : 'http://localhost:3001/api';

interface StreamEntry {
  streamId: string;
  title: string;
  branch: string;
  worktreePath: string;
  previousStatus: string;
  newStatus?: string;
  reason: string;
}

interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  commitHash: string;
  isMain: boolean;
}

interface ReconciliationSummary {
  totalInDb: number;
  totalWorktrees: number;
  active: number;
  completed: number;
  stale: number;
  orphaned: number;
  errors: number;
}

export interface ReconciliationResult {
  timestamp: string;
  dryRun: boolean;
  active: StreamEntry[];
  completed: StreamEntry[];
  stale: StreamEntry[];
  orphaned: WorktreeInfo[];
  errors: { streamId: string; error: string }[];
  summary: ReconciliationSummary;
}

interface UseReconciliationResult {
  status: ReconciliationResult | null;
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  runReconciliation: (options?: { autoArchiveStale?: boolean }) => Promise<ReconciliationResult | null>;
}

export function useReconciliation(): UseReconciliationResult {
  const [status, setStatus] = useState<ReconciliationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/reconciliation/status`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reconciliation status');
      console.error('Error fetching reconciliation status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const runReconciliation = useCallback(async (options?: { autoArchiveStale?: boolean }): Promise<ReconciliationResult | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/reconciliation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: false,
          autoArchiveStale: options?.autoArchiveStale ?? false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run reconciliation');
      console.error('Error running reconciliation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, loading, error, fetchStatus, runReconciliation };
}
