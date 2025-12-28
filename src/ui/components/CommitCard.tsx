/**
 * CommitCard Component
 *
 * Rich commit display with expand/collapse functionality.
 * Shows stream context, branch, worktree, and activity heat visualization.
 */

import { memo } from 'react';
import styled, { css } from 'styled-components';
import { ChevronDown, ChevronUp, GitCommit, Check, Copy } from 'lucide-react';
import type { EnrichedCommit, ActivityLevel } from '../../types/index.js';

// Activity heat colors
const activityColors = {
  hot: css`
    border-left-color: ${props => props.theme.colors.primary};
    border-left-width: 4px;
    box-shadow: 0 0 8px ${props => props.theme.colors.primary}40;
  `,
  warm: css`
    border-left-color: ${props => props.theme.colors.primary};
    border-left-width: 3px;
  `,
  cold: css`
    border-left-color: ${props => props.theme.colors.secondary};
    border-left-width: 2px;
  `,
};

const CardContainer = styled.div<{ $activity: ActivityLevel; $expanded: boolean }>`
  background: ${props => props.theme.colors.hover.surface};
  border-radius: ${props => props.theme.borderRadius.sm};
  border-left-style: solid;
  ${props => activityColors[props.$activity]}
  padding: ${props => props.theme.spacing.md};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.normal};

  &:hover {
    background: ${props => props.theme.colors.surface};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${props => props.theme.spacing.sm};
`;

const TimelineMarker = styled.div<{ $activity: ActivityLevel }>`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$activity === 'cold'
    ? props.theme.colors.secondary
    : props.theme.colors.primary};
  border-radius: 50%;
  color: ${props => props.theme.colors.surface};

  ${props => props.$activity === 'hot' && css`
    box-shadow: 0 0 6px ${props.theme.colors.primary};
  `}
`;

const CardContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const FirstRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  flex-wrap: wrap;
`;

const StreamBadge = styled.span<{ $merged?: boolean }>`
  font-family: 'Courier New', monospace;
  font-weight: 700;
  font-size: 0.875rem;
  color: ${props => props.$merged
    ? props.theme.colors.success
    : props.theme.colors.primary};
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MergedTag = styled.span`
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 3px;
  background: ${props => props.theme.colors.success}20;
  color: ${props => props.theme.colors.success};
`;

const CommitMessage = styled.span`
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  word-break: break-word;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  margin-top: ${props => props.theme.spacing.xs};
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  flex-wrap: wrap;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;

  &::before {
    content: '';
  }

  &:not(:first-child)::before {
    content: '•';
    margin-right: 4px;
    color: ${props => props.theme.colors.text.muted};
  }
`;

const BranchSnippet = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.muted};
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ExpandButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: ${props => props.theme.colors.text.muted};
  cursor: pointer;
  border-radius: ${props => props.theme.borderRadius.sm};
  transition: all ${props => props.theme.transitions.fast};

  &:hover {
    background: ${props => props.theme.colors.hover.surface};
    color: ${props => props.theme.colors.text.primary};
  }
`;

const ExpandedDetails = styled.div<{ $visible: boolean }>`
  max-height: ${props => props.$visible ? '300px' : '0'};
  overflow: hidden;
  transition: max-height ${props => props.theme.transitions.slow};
  margin-top: ${props => props.$visible ? props.theme.spacing.md : '0'};
  padding-top: ${props => props.$visible ? props.theme.spacing.md : '0'};
  border-top: ${props => props.$visible ? `1px solid ${props.theme.colors.border}` : 'none'};
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.md};
  font-size: 0.875rem;
`;

const DetailLabel = styled.span`
  color: ${props => props.theme.colors.text.muted};
  font-weight: 500;
`;

const DetailValue = styled.span`
  color: ${props => props.theme.colors.text.primary};
  font-family: 'Courier New', monospace;
  word-break: break-all;
`;

const HashValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
  cursor: pointer;
  color: ${props => props.theme.colors.primary};

  &:hover {
    text-decoration: underline;
  }
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;

  ${props => {
    switch (props.$status) {
      case 'active':
        return css`
          background: ${props.theme.colors.primary}20;
          color: ${props.theme.colors.primary};
        `;
      case 'completed':
        return css`
          background: ${props.theme.colors.success}20;
          color: ${props.theme.colors.success};
        `;
      case 'blocked':
        return css`
          background: ${props.theme.colors.error}20;
          color: ${props.theme.colors.error};
        `;
      case 'paused':
        return css`
          background: ${props.theme.colors.warning}20;
          color: ${props.theme.colors.warning};
        `;
      default:
        return css`
          background: ${props.theme.colors.info}20;
          color: ${props.theme.colors.info};
        `;
    }
  }}
`;

interface CommitCardProps {
  commit: EnrichedCommit;
  isExpanded: boolean;
  onToggleExpand: () => void;
  style?: React.CSSProperties;
}

function CommitCardComponent({
  commit,
  isExpanded,
  onToggleExpand,
  style,
}: CommitCardProps) {
  const handleCopyHash = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (commit.hash) {
      navigator.clipboard.writeText(commit.hash);
    }
  };

  const branchSnippet = commit.streamContext?.branch
    ? commit.streamContext.branch.replace(/^(feature|fix|hotfix|release)\//, '')
    : undefined;

  const statusLabel = commit.streamContext?.status === 'completed'
    ? 'Merged to main'
    : commit.streamContext?.status === 'active'
      ? 'Active'
      : commit.streamContext?.status || 'Unknown';

  return (
    <CardContainer
      $activity={commit.activityLevel}
      $expanded={isExpanded}
      onClick={onToggleExpand}
      style={style}
    >
      <CardHeader>
        <TimelineMarker $activity={commit.activityLevel}>
          <GitCommit size={14} />
        </TimelineMarker>

        <CardContent>
          <FirstRow>
            <StreamBadge $merged={commit.isMerged}>
              [{commit.streamNumber || '???'}]
              {commit.isMerged && <Check size={12} />}
            </StreamBadge>
            {commit.isMerged && <MergedTag>Merged</MergedTag>}
            <CommitMessage>{(commit.message || 'No message').split(/\\n|\n/)[0]}</CommitMessage>
          </FirstRow>

          <MetaRow>
            {commit.author && <MetaItem>@{commit.author}</MetaItem>}
            {commit.filesChanged !== undefined && (
              <MetaItem>{commit.filesChanged} file{commit.filesChanged !== 1 ? 's' : ''}</MetaItem>
            )}
            <MetaItem>{commit.relativeTime}</MetaItem>
            {branchSnippet && (
              <MetaItem>
                <BranchSnippet>{branchSnippet}</BranchSnippet>
              </MetaItem>
            )}
          </MetaRow>
        </CardContent>

        <ExpandButton onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </ExpandButton>
      </CardHeader>

      <ExpandedDetails $visible={isExpanded}>
        <DetailGrid>
          {commit.streamContext?.branch && (
            <>
              <DetailLabel>Branch</DetailLabel>
              <DetailValue>{commit.streamContext.branch}</DetailValue>
            </>
          )}

          {commit.streamContext?.worktreePath && (
            <>
              <DetailLabel>Worktree</DetailLabel>
              <DetailValue>{commit.streamContext.worktreePath}</DetailValue>
            </>
          )}

          {commit.hash && (
            <>
              <DetailLabel>Hash</DetailLabel>
              <DetailValue>
                <HashValue onClick={handleCopyHash}>
                  {commit.hash.substring(0, 7)}
                  <Copy size={12} />
                </HashValue>
              </DetailValue>
            </>
          )}

          <DetailLabel>Status</DetailLabel>
          <DetailValue>
            <StatusBadge $status={commit.streamContext?.status || 'unknown'}>
              {statusLabel}
            </StatusBadge>
          </DetailValue>

          {commit.streamContext?.title && (
            <>
              <DetailLabel>Stream</DetailLabel>
              <DetailValue>{commit.streamContext.title}</DetailValue>
            </>
          )}
        </DetailGrid>
      </ExpandedDetails>
    </CardContainer>
  );
}

export const CommitCard = memo(CommitCardComponent);
