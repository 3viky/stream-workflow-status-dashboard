/**
 * Stream Dashboard Application
 *
 * Real-time dashboard showing commit activity, KPIs, and stream status
 * Layout: Commits (top) → KPIs → Streams (scrollable)
 */

import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Heading } from './components/ui';
import { Activity, AlertCircle } from 'lucide-react';
import { QuickStats, FilterBar, StreamTable, ActivityTimeline } from './components';
import { useStreams, useCommits, useStats, useServerEvents } from './hooks';
import { ConnectionProvider, useConnectionStatus, type ConnectionState } from './contexts/ConnectionContext';
import type { FilterOptions } from '../types/index.js';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const AppContainer = styled.div`
  min-height: 100vh;
  width: 100%;
  background: ${props => props.theme.colors.background.primary};
  display: flex;
  flex-direction: column;
`;

const DashboardHeader = styled.div`
  padding: ${props => props.theme.spacing.lg} ${props => props.theme.spacing.xl};
  background: ${props => props.theme.colors.surface};
  border-bottom: 2px solid ${props => props.theme.colors.border};
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${props => props.theme.spacing.md};
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
`;

const getStatusColor = (state: ConnectionState, theme: any): string => {
  switch (state) {
    case 'live': return theme.colors.success;
    case 'stale': return theme.colors.warning;
    case 'connecting': return theme.colors.primary;
    case 'disconnected': return theme.colors.error;
    default: return theme.colors.text.muted;
  }
};

const StatusIndicator = styled.div<{ $state: ConnectionState }>`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => getStatusColor(props.$state, props.theme)};
    animation: ${props => props.$state === 'live' ? 'pulse 2s infinite' : 'none'};
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const DashboardContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${props => props.theme.spacing.lg};
  max-width: 1800px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
`;

const Section = styled.section<{ $maxHeight?: string; $compact?: boolean; $flexGrow?: boolean }>`
  margin-bottom: 0;
  flex-shrink: 0;

  ${props => props.$flexGrow && `
    flex: 1;
    min-height: 200px;
    overflow-y: auto;
  `}

  ${props => props.$maxHeight && `
    max-height: ${props.$maxHeight};
    overflow-y: auto;
  `}
`;

const ErrorBanner = styled.div`
  background: ${props => props.theme.colors.error};
  color: white;
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.md};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const LoadingOverlay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xxl};
  color: ${props => props.theme.colors.text.secondary};
  font-size: 1.125rem;
`;

// ============================================================================
// COMPONENT
// ============================================================================

const STATUS_LABELS: Record<ConnectionState, string> = {
  live: 'Live',
  stale: 'Stale',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
};

function Dashboard() {
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    category: 'all',
    priority: 'all',
    search: '',
  });

  // Connection status from context
  const { status: connectionStatus, markDataReceived } = useConnectionStatus();

  // Subscribe to heartbeat events to keep connection status fresh
  const handleHeartbeat = useCallback(() => {
    markDataReceived();
  }, [markDataReceived]);
  useServerEvents('heartbeat', handleHeartbeat);

  // Fetch data from API
  const {
    streams,
    loading: streamsLoading,
    error: streamsError,
    retireStream,
    retireStreams,
  } = useStreams();
  const { commits, loading: commitsLoading, loadingMore, error: commitsError, hasMore, loadMore } = useCommits(50);
  const { stats, loading: statsLoading } = useStats();

  // Filter streams based on current filter state
  // Note: No need to filter 'archived' - retired streams are deleted from DB
  const filteredStreams = streams.filter((stream) => {
    if (filters.status !== 'all' && stream.status !== filters.status) return false;
    if (filters.category !== 'all' && stream.category !== filters.category) return false;
    if (filters.priority !== 'all' && stream.priority !== filters.priority) return false;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const titleMatch = stream.title.toLowerCase().includes(searchLower);
      const numberMatch = stream.streamNumber.includes(searchLower);
      if (!titleMatch && !numberMatch) return false;
    }

    return true;
  });

  // Format status label with time if stale
  const statusLabel = connectionStatus.state === 'stale' && connectionStatus.secondsSinceUpdate
    ? `${STATUS_LABELS[connectionStatus.state]} (${connectionStatus.secondsSinceUpdate}s)`
    : STATUS_LABELS[connectionStatus.state];

  return (
    <AppContainer>
      <DashboardHeader>
        <HeaderContent>
          <Activity size={28} />
          <Heading as="h1">
            Stream Status Dashboard
          </Heading>
        </HeaderContent>
        <StatusIndicator $state={connectionStatus.state}>
          {statusLabel}
        </StatusIndicator>
      </DashboardHeader>

      <DashboardContent>
        {/* Error banners */}
        {streamsError && (
          <ErrorBanner>
            <AlertCircle size={20} />
            <span>Failed to load streams: {streamsError}</span>
          </ErrorBanner>
        )}
        {commitsError && (
          <ErrorBanner>
            <AlertCircle size={20} />
            <span>Failed to load commits: {commitsError}</span>
          </ErrorBanner>
        )}

        {/* 1. Activity Timeline (Collapsible - starts collapsed) */}
        <Section $compact>
          <ActivityTimeline
            commits={commits}
            streams={streams}
            loading={commitsLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            defaultCollapsed={true}
            height={220}
          />
        </Section>

        {/* 2. Quick Statistics (KPIs) */}
        <Section $compact>
          <QuickStats stats={stats} loading={statsLoading} />
        </Section>

        {/* 3. Stream Filters */}
        <Section $compact>
          <FilterBar filters={filters} onFilterChange={setFilters} />
        </Section>

        {/* 4. Streams Table (Primary content - takes remaining space) */}
        <Section $flexGrow>
          {streamsLoading && streams.length === 0 ? (
            <LoadingOverlay>Loading streams...</LoadingOverlay>
          ) : (
            <StreamTable
              streams={filteredStreams}
              onRetire={retireStream}
              onRetireBulk={retireStreams}
            />
          )}
        </Section>
      </DashboardContent>
    </AppContainer>
  );
}

// Wrap Dashboard with ConnectionProvider
function App() {
  return (
    <ConnectionProvider>
      <Dashboard />
    </ConnectionProvider>
  );
}

export default App;
