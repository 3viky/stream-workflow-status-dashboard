/**
 * QuickStats Component
 *
 * Minimal stats cards showing stream counts by status
 */

import styled from 'styled-components';
import { Card } from './ui';
import type { QuickStats as QuickStatsType } from '../../types/index.js';

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${props => props.theme.spacing.sm};
`;

const StatCard = styled(Card)`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 2px;
  line-height: 1;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

interface QuickStatsProps {
  stats: QuickStatsType;
  loading?: boolean;
}

export function QuickStats({ stats, loading = false }: QuickStatsProps) {
  const displayStats = loading && Object.values(stats).every(v => v === 0)
    ? { activeStreams: '—', inProgress: '—', blocked: '—', readyToStart: '—' }
    : stats;

  return (
    <StatsGrid>
      <StatCard>
        <StatValue>{displayStats.activeStreams}</StatValue>
        <StatLabel>Total Streams</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{displayStats.inProgress}</StatValue>
        <StatLabel>Working</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{displayStats.blocked}</StatValue>
        <StatLabel>Blocked</StatLabel>
      </StatCard>
      <StatCard>
        <StatValue>{displayStats.readyToStart}</StatValue>
        <StatLabel>Paused</StatLabel>
      </StatCard>
    </StatsGrid>
  );
}
