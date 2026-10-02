import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoalsPage } from './GoalsPage';
import * as goalsHooks from '../features/goals/useGoals';
import type { GoalDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockGoals: GoalDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: 'user_123',
    title: 'Master Backend Architecture',
    description: 'Learn distributed consensus and streaming architectures',
    goal_type: 'learning',
    status: 'active',
    priority: 'high',
    start_date: '2026-10-01T00:00:00.000Z',
    target_date: '2026-12-31T00:00:00.000Z',
    completed_at: null,
    desired_outcome: 'Build production-ready services',
    completion_criteria: 'Pass systems review',
    notes: 'Prioritize DDIA and Raft',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    metrics: {
      milestoneCount: 4,
      completedMilestoneCount: 2,
      progressPercentage: 50,
      healthStatus: 'on_track',
      healthReason: 'Progress is on schedule.',
    },
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    user_id: 'user_123',
    title: 'Publish Tech Whitepaper',
    description: null,
    goal_type: 'career',
    status: 'paused',
    priority: 'medium',
    start_date: null,
    target_date: null,
    completed_at: null,
    desired_outcome: null,
    completion_criteria: null,
    notes: null,
    created_at: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    metrics: {
      milestoneCount: 0,
      completedMilestoneCount: 0,
      progressPercentage: 0,
      healthStatus: 'unknown',
      healthReason: 'Goal is currently in paused status.',
    },
  },
];

function renderGoalsPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GoalsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('GoalsPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  it('renders goals list with badges, titles, and progress', () => {
    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: {
        data: mockGoals,
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    renderGoalsPage(queryClient);

    // Header
    expect(screen.getByRole('heading', { level: 1, name: /Goals/i })).toBeInTheDocument();
    expect(screen.getByText('2 goals')).toBeInTheDocument();

    // Goal items
    expect(screen.getByText('Master Backend Architecture')).toBeInTheDocument();
    expect(screen.getByText('Publish Tech Whitepaper')).toBeInTheDocument();

    // Badges
    expect(screen.getAllByText('Learning')[0]).toBeInTheDocument();
    expect(screen.getAllByText('High')[0]).toBeInTheDocument();
    expect(screen.getAllByText('On Track')[0]).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2/4 milestones')).toBeInTheDocument();
  });

  it('renders empty state when there are no goals', () => {
    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: {
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    renderGoalsPage(queryClient);

    expect(screen.getByText(/Create your first goal/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Goals bridge long-term vision with deterministic execution/i)
    ).toBeInTheDocument();
  });

  it('opens Create Goal modal when clicking create goal button', async () => {
    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: {
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    renderGoalsPage(queryClient);

    const createButtons = screen.getAllByRole('button', { name: /Create Goal/i });
    fireEvent.click(createButtons[0]!);

    expect(screen.getByRole('heading', { level: 3, name: /Create Growth Goal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Goal Title/i)).toBeInTheDocument();
  });

  it('renders error state when query fails', () => {
    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error loading goals'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    renderGoalsPage(queryClient);

    expect(screen.getByText(/Failed to Load Goals/i)).toBeInTheDocument();
    expect(screen.getByText(/Network error loading goals/i)).toBeInTheDocument();
  });
});
