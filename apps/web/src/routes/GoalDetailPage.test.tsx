import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoalDetailPage } from './GoalDetailPage';
import * as goalsHooks from '../features/goals/useGoals';
import type { GoalDetailDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockGoalDetail: GoalDetailDto = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: 'user_123',
  title: 'Master Backend Architecture',
  description: 'Deep dive into concurrent systems',
  goal_type: 'learning',
  status: 'active',
  priority: 'high',
  start_date: '2026-10-01T00:00:00.000Z',
  target_date: '2026-12-31T00:00:00.000Z',
  completed_at: null,
  desired_outcome: 'Build scalable distributed services',
  completion_criteria: 'Pass architecture evaluation',
  notes: 'Focus on Raft and DDIA',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  metrics: {
    milestoneCount: 2,
    completedMilestoneCount: 1,
    progressPercentage: 50,
    healthStatus: 'on_track',
    healthReason: 'Progress is on schedule.',
  },
  milestones: [
    {
      id: 'ms-1',
      goal_id: '11111111-1111-1111-1111-111111111111',
      title: 'Complete Distributed Systems Book',
      description: 'Finish all 12 chapters',
      status: 'completed',
      priority: 'high',
      order_index: 0,
      start_date: '2026-10-01T00:00:00.000Z',
      target_date: '2026-10-31T00:00:00.000Z',
      completed_at: '2026-10-25T00:00:00.000Z',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-25T00:00:00.000Z',
    },
    {
      id: 'ms-2',
      goal_id: '11111111-1111-1111-1111-111111111111',
      title: 'Implement Raft in Go',
      description: 'Build consensus leader election',
      status: 'pending',
      priority: 'critical',
      order_index: 1,
      start_date: '2026-11-01T00:00:00.000Z',
      target_date: '2026-11-30T00:00:00.000Z',
      completed_at: null,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    },
  ],
};

function renderGoalDetailPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/goals/11111111-1111-1111-1111-111111111111']}>
        <Routes>
          <Route path="/goals/:id" element={<GoalDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GoalDetailPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.restoreAllMocks();
  });

  it('renders goal details with desired outcome, completion criteria, and milestones', () => {
    vi.spyOn(goalsHooks, 'useGoal').mockReturnValue({
      data: mockGoalDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoal>);

    renderGoalDetailPage(queryClient);

    // Title & description
    expect(screen.getByRole('heading', { level: 1, name: /Master Backend Architecture/i })).toBeInTheDocument();
    expect(screen.getByText('Deep dive into concurrent systems')).toBeInTheDocument();

    // Desired Outcome & Completion criteria
    expect(screen.getByText('Build scalable distributed services')).toBeInTheDocument();
    expect(screen.getByText('Pass architecture evaluation')).toBeInTheDocument();

    // Progress and health
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('Progress is on schedule.')).toBeInTheDocument();

    // Milestones
    expect(screen.getByText('Complete Distributed Systems Book')).toBeInTheDocument();
    expect(screen.getByText('Implement Raft in Go')).toBeInTheDocument();
    expect(screen.getByText('#0')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('opens Edit Goal modal when clicking Edit button', () => {
    vi.spyOn(goalsHooks, 'useGoal').mockReturnValue({
      data: mockGoalDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoal>);

    renderGoalDetailPage(queryClient);

    const editBtn = screen.getByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { level: 3, name: /Edit Goal/i })).toBeInTheDocument();
  });

  it('opens Add Milestone modal when clicking Add Milestone button', () => {
    vi.spyOn(goalsHooks, 'useGoal').mockReturnValue({
      data: mockGoalDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoal>);

    renderGoalDetailPage(queryClient);

    const addMsBtn = screen.getByRole('button', { name: /Add Milestone/i });
    fireEvent.click(addMsBtn);

    expect(screen.getByRole('heading', { level: 3, name: /Add Milestone/i })).toBeInTheDocument();
  });

  it('opens Delete Confirmation dialog when clicking Delete button', () => {
    vi.spyOn(goalsHooks, 'useGoal').mockReturnValue({
      data: mockGoalDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoal>);

    renderGoalDetailPage(queryClient);

    const deleteBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('heading', { level: 3, name: /Delete Goal/i })).toBeInTheDocument();
    expect(screen.getByText(/All associated milestones will be permanently removed/i)).toBeInTheDocument();
  });
});
