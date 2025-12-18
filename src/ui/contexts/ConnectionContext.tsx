/**
 * Connection Status Context
 *
 * Provides centralized connection status tracking for all data hooks.
 * Hooks report successful fetches, and this context calculates overall
 * connection state (live/stale/disconnected).
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export type ConnectionState = 'live' | 'stale' | 'disconnected' | 'connecting';

interface ConnectionStatus {
  state: ConnectionState;
  lastUpdate: number | null;
  secondsSinceUpdate: number | null;
}

interface ConnectionContextValue {
  status: ConnectionStatus;
  markDataReceived: () => void;
  markError: () => void;
  markLoading: () => void;
}

const STALE_THRESHOLD_MS = 60_000;         // 60 seconds
const DISCONNECTED_THRESHOLD_MS = 300_000; // 5 minutes
const CHECK_INTERVAL_MS = 5_000;           // Check every 5 seconds

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<ConnectionState>('connecting');
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculateState = useCallback((): ConnectionState => {
    if (hasError) return 'disconnected';
    if (isLoading && lastUpdate === null) return 'connecting';
    if (lastUpdate === null) return 'disconnected';

    const elapsed = Date.now() - lastUpdate;

    if (elapsed >= DISCONNECTED_THRESHOLD_MS) return 'disconnected';
    if (elapsed >= STALE_THRESHOLD_MS) return 'stale';
    return 'live';
  }, [lastUpdate, hasError, isLoading]);

  const updateState = useCallback(() => {
    const newState = calculateState();
    setState(newState);

    if (lastUpdate !== null) {
      setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdate) / 1000));
    } else {
      setSecondsSinceUpdate(null);
    }
  }, [calculateState, lastUpdate]);

  const markDataReceived = useCallback(() => {
    setLastUpdate(Date.now());
    setHasError(false);
    setIsLoading(false);
  }, []);

  const markError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const markLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  // Periodic check for staleness
  useEffect(() => {
    updateState();

    intervalRef.current = setInterval(updateState, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateState]);

  return (
    <ConnectionContext.Provider
      value={{
        status: { state, lastUpdate, secondsSinceUpdate },
        markDataReceived,
        markError,
        markLoading,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnectionStatus(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnectionStatus must be used within a ConnectionProvider');
  }
  return context;
}
