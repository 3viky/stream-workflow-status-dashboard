/**
 * FilterBar Component
 *
 * Filter controls for status, category, priority, and search
 */

import styled from 'styled-components';
import { Select, Input } from './ui';
import { Search } from 'lucide-react';
import type { FilterOptions, StreamStatus, StreamCategory, StreamPriority } from '../../types/index.js';

const FilterContainer = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  flex-wrap: wrap;
  align-items: center;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  flex-shrink: 0;
`;

const FilterLabel = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.secondary};
  white-space: nowrap;
`;

const SearchWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 400px;

  svg {
    position: absolute;
    left: ${props => props.theme.spacing.sm};
    top: 50%;
    transform: translateY(-50%);
    color: ${props => props.theme.colors.text.secondary};
    pointer-events: none;
  }

  input {
    padding-left: 2.5rem;
  }
`;

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
}

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'initializing', label: 'Initializing' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed (Ready to Retire)' },
  // Note: 'archived' removed - retired streams are deleted from database
];

const categoryOptions = [
  { value: 'all', label: 'All Categories' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'refactoring', label: 'Refactoring' },
  { value: 'testing', label: 'Testing' },
];

const priorityOptions = [
  { value: 'all', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  return (
    <FilterContainer>
      <FilterGroup>
        <FilterLabel>Status:</FilterLabel>
        <Select
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value as StreamStatus | 'all' })}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup>
        <FilterLabel>Category:</FilterLabel>
        <Select
          value={filters.category}
          onChange={(e) => onFilterChange({ ...filters, category: e.target.value as StreamCategory | 'all' })}
        >
          {categoryOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup>
        <FilterLabel>Priority:</FilterLabel>
        <Select
          value={filters.priority}
          onChange={(e) => onFilterChange({ ...filters, priority: e.target.value as StreamPriority | 'all' })}
        >
          {priorityOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </FilterGroup>

      <SearchWrapper>
        <Search size={18} />
        <Input
          type="text"
          placeholder="Search streams by title..."
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
        />
      </SearchWrapper>
    </FilterContainer>
  );
}
