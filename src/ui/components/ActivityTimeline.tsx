/**
 * ActivityTimeline Component
 *
 * Rich commit stream visualization with virtualization, grouping, and filtering.
 * Replaces CommitStream - single source of truth, no legacy code.
 */

import { useState, useMemo, useCallback, useRef, forwardRef, useEffect } from 'react';
import styled from 'styled-components';
import { VariableSizeList as List } from 'react-window';
import { GitCommit, Activity, Filter, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import { Heading, Select } from './ui';
import { CommitCard } from './CommitCard';
import {
  enrichCommits,
  groupCommits,
  calculateWorktreeSummary,
  getGroupLabel,
} from '../utils/commitEnrichment';
import type { Commit, Stream, EnrichedCommit, GroupBy, GroupingKey } from '../../types/index.js';

const TimelineContainer = styled.div<{ $collapsed?: boolean }>`
  background: ${props => props.theme.colors.bg.secondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.md};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  ${props => props.$collapsed && `max-height: 56px;`}
  transition: max-height 0.3s ease;
`;

const TimelineHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${props => props.theme.spacing.md};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  flex-wrap: wrap;
  gap: ${props => props.theme.spacing.sm};
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

const SummaryBadge = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const SummaryItem = styled.span<{ $type: 'active' | 'merged' }>`
  display: flex;
  align-items: center;
  gap: 4px;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$type === 'active'
      ? props.theme.colors.primary
      : props.theme.colors.success};
  }
`;

const GroupByLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const SmallSelect = styled(Select)`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  font-size: 0.875rem;
  min-width: 100px;
`;

const CollapseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xs};
  background: transparent;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.sm};
  color: ${props => props.theme.colors.text.secondary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.hover.surface};
    color: ${props => props.theme.colors.text.primary};
  }
`;

const TimelineContent = styled.div<{ $height: number }>`
  height: ${props => props.$height}px;
  flex: 1;
  min-height: 0;
`;

const ResizeHandle = styled.div<{ $isDragging?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 12px;
  cursor: ns-resize;
  background: ${props => props.$isDragging
    ? props.theme.colors.primary + '33'
    : props.theme.colors.surface};
  border-top: 1px solid ${props => props.theme.colors.border};
  transition: background 0.15s ease;
  user-select: none;

  &:hover {
    background: ${props => props.theme.colors.hover.surface};
  }

  svg {
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }

  &:hover svg {
    opacity: 0.8;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  background: ${props => props.theme.colors.background.tertiary};
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const SectionTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: ${props => props.theme.colors.text.secondary};
`;

const SectionCount = styled.span`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.muted};
  background: ${props => props.theme.colors.background.secondary};
  padding: 2px 8px;
  border-radius: 10px;
`;

const CommitWrapper = styled.div`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.md};
`;

const NoCommits = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xxl};
  color: ${props => props.theme.colors.text.secondary};
  text-align: center;
  gap: ${props => props.theme.spacing.md};
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xxl};
  color: ${props => props.theme.colors.text.secondary};
`;

const LoadingMore = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.md};
  color: ${props => props.theme.colors.text.muted};
  font-size: 0.875rem;
`;

// Custom outer element for virtual list with scrollbar styling
const OuterElement = forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  (props, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        ...props.style,
        overflowX: 'hidden',
      }}
    />
  )
);
OuterElement.displayName = 'OuterElement';

interface ActivityTimelineProps {
  commits: Commit[];
  streams: Stream[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  defaultCollapsed?: boolean;
  height?: number;
}

// Item types for the flat list
type ListItem =
  | { type: 'section'; key: string; count: number }
  | { type: 'commit'; commit: EnrichedCommit };

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const STORAGE_KEY = 'stream-dashboard-timeline';

interface TimelineSettings {
  collapsed: boolean;
  height: number;
}

function loadSettings(defaults: TimelineSettings): TimelineSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<TimelineSettings>;
      return {
        collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : defaults.collapsed,
        height: typeof parsed.height === 'number'
          ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, parsed.height))
          : defaults.height,
      };
    }
  } catch {
    // Ignore localStorage errors
  }
  return defaults;
}

function saveSettings(settings: TimelineSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage errors (quota exceeded, etc.)
  }
}

export function ActivityTimeline({
  commits,
  streams,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  defaultCollapsed = false,
  height = 250,
}: ActivityTimelineProps) {
  // Load initial state from localStorage
  const initialSettings = useMemo(
    () => loadSettings({ collapsed: defaultCollapsed, height }),
    // Only compute once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [groupBy, setGroupBy] = useState<GroupBy>('time');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(initialSettings.collapsed);
  const [currentHeight, setCurrentHeight] = useState(initialSettings.height);
  const [isDragging, setIsDragging] = useState(false);
  const listRef = useRef<List>(null);
  const dragStartRef = useRef<{ y: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist settings to localStorage when they change
  useEffect(() => {
    saveSettings({ collapsed, height: currentHeight });
  }, [collapsed, currentHeight]);

  // Handle drag to resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, height: currentHeight };
  }, [currentHeight]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = e.clientY - dragStartRef.current.y;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartRef.current.height + delta));
      setCurrentHeight(newHeight);
      // Reset list cache when height changes
      listRef.current?.resetAfterIndex(0);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Auto-expand when starting to drag from collapsed state
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (collapsed) {
      setCollapsed(false);
      setCurrentHeight(MIN_HEIGHT);
    }
    handleMouseDown(e);
  }, [collapsed, handleMouseDown]);

  // Enrich commits with stream context
  const enrichedCommits = useMemo(
    () => enrichCommits(commits, streams),
    [commits, streams]
  );

  // Group commits
  const groupedCommits = useMemo(
    () => groupCommits(enrichedCommits, groupBy),
    [enrichedCommits, groupBy]
  );

  // Calculate worktree summary for header
  const summary = useMemo(
    () => calculateWorktreeSummary(streams),
    [streams]
  );

  // Flatten groups into list items for virtualization
  const flatItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    for (const [key, commits] of groupedCommits) {
      items.push({ type: 'section', key, count: commits.length });
      for (const commit of commits) {
        items.push({ type: 'commit', commit });
      }
    }
    // Add loading indicator at the end if loading more
    if (loadingMore) {
      items.push({ type: 'section', key: '__loading__', count: 0 });
    }
    return items;
  }, [groupedCommits, loadingMore]);

  // Get item size for variable size list
  const getItemSize = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (item.type === 'section') {
        if (item.key === '__loading__') {
          return 48; // Loading indicator height
        }
        return 36; // Section header height
      }
      // Commit card: 80px collapsed, ~200px expanded
      const isExpanded = expandedIds.has(item.commit.id);
      return isExpanded ? 220 : 80;
    },
    [flatItems, expandedIds]
  );

  // Handle scroll for infinite loading
  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStopIndex: number }) => {
      // Load more when user scrolls within 5 items of the end
      if (hasMore && !loadingMore && onLoadMore && visibleStopIndex >= flatItems.length - 5) {
        onLoadMore();
      }
    },
    [flatItems.length, hasMore, loadingMore, onLoadMore]
  );

  // Toggle commit expansion
  const toggleExpand = useCallback((commitId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(commitId)) {
        next.delete(commitId);
      } else {
        next.add(commitId);
      }
      return next;
    });
    // Reset list cache when sizes change
    listRef.current?.resetAfterIndex(0);
  }, []);

  // Handle group by change
  const handleGroupByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGroupBy(e.target.value as GroupBy);
    setExpandedIds(new Set()); // Collapse all on re-group
    listRef.current?.resetAfterIndex(0);
  };

  // Render list item
  const renderItem = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = flatItems[index];

      if (item.type === 'section') {
        // Loading indicator
        if (item.key === '__loading__') {
          return (
            <LoadingMore style={style}>
              Loading more commits...
            </LoadingMore>
          );
        }

        const label = groupBy === 'time'
          ? getGroupLabel(item.key as GroupingKey)
          : groupBy === 'stream'
            ? `Stream ${item.key}`
            : `@${item.key}`;

        return (
          <SectionHeader style={style}>
            <SectionTitle>{label}</SectionTitle>
            <SectionCount>{item.count} commit{item.count !== 1 ? 's' : ''}</SectionCount>
          </SectionHeader>
        );
      }

      return (
        <CommitWrapper style={style}>
          <CommitCard
            commit={item.commit}
            isExpanded={expandedIds.has(item.commit.id)}
            onToggleExpand={() => toggleExpand(item.commit.id)}
          />
        </CommitWrapper>
      );
    },
    [flatItems, expandedIds, toggleExpand, groupBy]
  );

  if (loading && commits.length === 0) {
    return (
      <TimelineContainer $collapsed={collapsed} ref={containerRef}>
        <TimelineHeader>
          <HeaderLeft>
            <CollapseButton onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </CollapseButton>
            <GitCommit size={20} />
            <Heading as="h3">Activity Timeline</Heading>
          </HeaderLeft>
        </TimelineHeader>
        {!collapsed && <LoadingState>Loading commits...</LoadingState>}
        <ResizeHandle
          $isDragging={isDragging}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <GripHorizontal size={14} />
        </ResizeHandle>
      </TimelineContainer>
    );
  }

  if (commits.length === 0) {
    return (
      <TimelineContainer $collapsed={collapsed} ref={containerRef}>
        <TimelineHeader>
          <HeaderLeft>
            <CollapseButton onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </CollapseButton>
            <GitCommit size={20} />
            <Heading as="h3">Activity Timeline</Heading>
          </HeaderLeft>
        </TimelineHeader>
        {!collapsed && (
          <NoCommits>
            <Activity size={48} />
            <span>No recent commits</span>
          </NoCommits>
        )}
        <ResizeHandle
          $isDragging={isDragging}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <GripHorizontal size={14} />
        </ResizeHandle>
      </TimelineContainer>
    );
  }

  return (
    <TimelineContainer $collapsed={collapsed} ref={containerRef}>
      <TimelineHeader>
        <HeaderLeft>
          <CollapseButton onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </CollapseButton>
          <GitCommit size={20} />
          <Heading as="h3">Activity Timeline</Heading>
          <SummaryBadge>
            <SummaryItem $type="active">
              {summary.activeCount} active
            </SummaryItem>
            <SummaryItem $type="merged">
              {summary.mergedCount} merged
            </SummaryItem>
          </SummaryBadge>
        </HeaderLeft>

        <HeaderRight>
          <GroupByLabel>
            <Filter size={14} />
            Group:
            <SmallSelect value={groupBy} onChange={handleGroupByChange}>
              <option value="time">Time</option>
              <option value="stream">Stream</option>
              <option value="author">Author</option>
            </SmallSelect>
          </GroupByLabel>
        </HeaderRight>
      </TimelineHeader>

      {!collapsed && (
        <TimelineContent $height={currentHeight}>
          <List
            ref={listRef}
            height={currentHeight}
            width="100%"
            itemCount={flatItems.length}
            itemSize={getItemSize}
            outerElementType={OuterElement}
            overscanCount={5}
            onItemsRendered={handleItemsRendered}
          >
            {renderItem}
          </List>
        </TimelineContent>
      )}

      <ResizeHandle
        $isDragging={isDragging}
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      >
        <GripHorizontal size={14} />
      </ResizeHandle>
    </TimelineContainer>
  );
}
