import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DsaOverview } from './DsaOverview';
import * as overviewHook from '../hooks/use-dsa-overview';

describe('DsaOverview Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state correctly', () => {
    vi.spyOn(overviewHook, 'useDsaOverview').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof overviewHook.useDsaOverview>);

    render(<DsaOverview />);
    expect(screen.getByText('Loading overview...')).toBeInTheDocument();
  });

  it('renders error state correctly without unhandled exceptions', () => {
    vi.spyOn(overviewHook, 'useDsaOverview').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to reach server'),
    } as unknown as ReturnType<typeof overviewHook.useDsaOverview>);

    render(<DsaOverview />);
    expect(screen.getByText('Error loading overview: Failed to reach server')).toBeInTheDocument();
  });

  it('renders overview metrics and recommended problem successfully', () => {
    vi.spyOn(overviewHook, 'useDsaOverview').mockReturnValue({
      data: {
        total_problems: 15,
        solved_problems: 8,
        attempted_problems: 12,
        revision_due_count: 3,
        weak_areas: [
          {
            topic_id: 't-1',
            topic_name: 'Dynamic Programming',
            problem_count: 5,
            failure_count: 3,
            reason: 'High failure count',
          },
        ],
        recommended_problem: {
          id: 'p-1',
          title: 'Climbing Stairs',
          reason: 'Strengthen weak topic Dynamic Programming',
        },
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof overviewHook.useDsaOverview>);

    render(<DsaOverview />);
    expect(screen.getByText('DSA Overview')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Climbing Stairs')).toBeInTheDocument();
    expect(screen.getByText('Dynamic Programming')).toBeInTheDocument();
  });
});
