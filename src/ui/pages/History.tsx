/**
 * Historical Milestones Page
 *
 * Shows completed work from .project/history markdown files
 * Displays: Milestone name, completion date, summary, key achievements
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Heading } from '../components/ui';
import { History as HistoryIcon, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PageContainer = styled.div`
  min-height: 100vh;
  width: 100%;
  background: ${props => props.theme.colors.background.primary};
  display: flex;
  flex-direction: column;
`;

const PageHeader = styled.div`
  padding: ${props => props.theme.spacing.lg} ${props => props.theme.spacing.xl};
  background: ${props => props.theme.colors.surface};
  border-bottom: 2px solid ${props => props.theme.colors.border};
  position: sticky;
  top: 0;
  z-index: 100;
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
`;

const PageContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${props => props.theme.spacing.xl};
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
`;

const Timeline = styled.div`
  position: relative;
  padding-left: ${props => props.theme.spacing.xl};

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: ${props => props.theme.colors.border};
  }
`;

const MilestoneCard = styled.div`
  position: relative;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.lg};
  padding: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.lg};
  margin-left: ${props => props.theme.spacing.xl};
  transition: all ${props => props.theme.transitions.normal};

  &::before {
    content: '';
    position: absolute;
    left: calc(-${props => props.theme.spacing.xl} - 6px);
    top: ${props => props.theme.spacing.lg};
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${props => props.theme.colors.success};
    border: 2px solid ${props => props.theme.colors.surface};
  }

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: ${props => props.theme.shadows.md};
    transform: translateX(4px);
  }
`;

const MilestoneHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.md};
`;

const MilestoneTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
`;

const MilestoneDate = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  white-space: nowrap;
`;

const MilestoneSummary = styled.p`
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin-bottom: ${props => props.theme.spacing.md};
`;

const AchievementsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${props => props.theme.spacing.sm} 0 0 0;
`;

const Achievement = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${props => props.theme.spacing.sm};
  padding: ${props => props.theme.spacing.xs} 0;
  color: ${props => props.theme.colors.text.secondary};
  font-size: 0.9375rem;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${props => props.theme.colors.success};
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xxl};
  color: ${props => props.theme.colors.text.secondary};
`;

const ErrorState = styled.div`
  background: ${props => props.theme.colors.error};
  color: white;
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  border-radius: ${props => props.theme.borderRadius.md};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${props => props.theme.spacing.xxl};
  color: ${props => props.theme.colors.text.secondary};
`;

// ============================================================================
// TYPES
// ============================================================================

interface Milestone {
  id: string;
  title: string;
  date: string;
  summary: string;
  achievements: string[];
  filename: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function History() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch real data from API endpoint that reads .project/history/*.md files
    // For now, showing placeholder data
    setTimeout(() => {
      setMilestones([
        {
          id: '1',
          title: 'Stream 0100 - Fix Pre-Existing Build Issues',
          date: '2025-12-07',
          summary: 'Resolved TypeScript compilation errors and build configuration issues across the monorepo.',
          achievements: [
            'Fixed 23 TypeScript errors in workspace packages',
            'Updated tsconfig.json files with correct module resolution',
            'Resolved circular dependency issues in @transftw packages',
          ],
          filename: '20251207_stream-0100-build-fixes-COMPLETE.md',
        },
        {
          id: '2',
          title: 'Milestone 2 - Multi-Tenant Architecture',
          date: '2025-11-04',
          summary: 'Successfully implemented multi-tenant orchestrator pattern with Vite alias resolution.',
          achievements: [
            'Created platform orchestrator app with dynamic app imports',
            'Implemented 22 AppConfig.json deployment configurations',
            'Validated dev and production routing for all tenants',
          ],
          filename: '20251104_M2-multi-tenant-architecture.md',
        },
        {
          id: '3',
          title: 'Milestone 1 - Production Deployment',
          date: '2025-11-04',
          summary: 'Deployed egirl-platform to production with Docker, Nginx, and PostgreSQL.',
          achievements: [
            'Configured Docker Compose for all services',
            'Set up Nginx reverse proxy with SSL',
            'Deployed to DigitalOcean Droplet',
          ],
          filename: '20251104_M1-production-deployment.md',
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  return (
    <PageContainer>
      <PageHeader>
        <HeaderContent>
          <HistoryIcon size={28} />
          <Heading as="h1">
            Historical Milestones
          </Heading>
        </HeaderContent>
      </PageHeader>

      <PageContent>
        {loading ? (
          <LoadingState>Loading milestones...</LoadingState>
        ) : error ? (
          <ErrorState>
            <AlertCircle size={20} />
            <span>{error}</span>
          </ErrorState>
        ) : milestones.length === 0 ? (
          <EmptyState>No milestones found</EmptyState>
        ) : (
          <Timeline>
            {milestones.map((milestone) => (
              <MilestoneCard key={milestone.id}>
                <MilestoneHeader>
                  <MilestoneTitle>{milestone.title}</MilestoneTitle>
                  <MilestoneDate>
                    <Calendar size={16} />
                    {new Date(milestone.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </MilestoneDate>
                </MilestoneHeader>

                <MilestoneSummary>{milestone.summary}</MilestoneSummary>

                {milestone.achievements.length > 0 && (
                  <AchievementsList>
                    {milestone.achievements.map((achievement, idx) => (
                      <Achievement key={idx}>
                        <CheckCircle size={16} />
                        <span>{achievement}</span>
                      </Achievement>
                    ))}
                  </AchievementsList>
                )}
              </MilestoneCard>
            ))}
          </Timeline>
        )}
      </PageContent>
    </PageContainer>
  );
}
