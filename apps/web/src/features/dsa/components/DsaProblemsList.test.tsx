import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DsaProblemsList } from './DsaProblemsList';
import * as problemsHook from '../hooks/use-dsa-problems';

describe('DsaProblemsList Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state correctly', () => {
    vi.spyOn(problemsHook, 'useDsaProblems').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof problemsHook.useDsaProblems>);

    render(
      <MemoryRouter>
        <DsaProblemsList />
      </MemoryRouter>
    );
    expect(screen.getByText('Loading problems...')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    vi.spyOn(problemsHook, 'useDsaProblems').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as unknown as ReturnType<typeof problemsHook.useDsaProblems>);

    render(
      <MemoryRouter>
        <DsaProblemsList />
      </MemoryRouter>
    );
    expect(screen.getByText('Error loading problems: Network error')).toBeInTheDocument();
  });

  it('renders empty state when no problems exist', () => {
    vi.spyOn(problemsHook, 'useDsaProblems').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof problemsHook.useDsaProblems>);

    render(
      <MemoryRouter>
        <DsaProblemsList />
      </MemoryRouter>
    );
    expect(screen.getByText(/No problems found. Create your first DSA problem to get started./i)).toBeInTheDocument();
  });

  it('renders problem items successfully when data is provided', () => {
    vi.spyOn(problemsHook, 'useDsaProblems').mockReturnValue({
      data: [
        {
          id: 'p-1',
          user_id: 'u-1',
          title: 'Two Sum',
          slug: 'two-sum',
          description: 'Find indices',
          difficulty: 'easy',
          source: 'system',
          status: 'active',
          external_url: null,
          estimated_minutes: 15,
          attempt_count: 2,
          solved_count: 1,
          failed_count: 1,
          last_attempt_at: null,
          last_solved_at: null,
          next_review_at: null,
          revision_count: 0,
          review_stage: 0,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof problemsHook.useDsaProblems>);

    render(
      <MemoryRouter>
        <DsaProblemsList />
      </MemoryRouter>
    );
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText(/Solved:\s*1\s*\/\s*2/)).toBeInTheDocument();
  });
});
