import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayPage } from './TodayPage';
import * as todayHooks from '../features/today/useToday';
import * as tasksHooks from '../features/tasks/useTasks';
import * as goalsHooks from '../features/goals/useGoals';
import type { TodayResponse, TaskDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockNextTask: TaskDto = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: 'user_123',
  title: 'Implement Raft Consensus Algorithm',
  description: 'Build leader election and log replication',
  task_type: 'project',
  status: 'in_progress',
  priority: 'high',
  goal_id: 'goal-1',
  milestone_id: 'ms-1',
  goal_title: 'Master Distributed Systems',
  milestone_title: 'Consensus Engines',
  estimated_minutes: 180,
  actual_minutes: null,
  due_at: '2026-10-03T15:00:00.000Z',
  scheduled_start: '2026-10-03T10:00:00.000Z',
  scheduled_end: '2026-10-03T13:00:00.000Z',
  completed_at: null,
  notes: 'See Ongaro paper',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  is_blocked: false,
  blocking_task_count: 0,
  blocked_by: [],
  metrics: {
    is_blocked: false,
    blocking_task_count: 0,
    blocked_by: [],
  },
};

const mockOverdueTask: TaskDto = {
  id: '22222222-2222-2222-2222-222222222222',
  user_id: 'user_123',
  title: 'Overdue Assignment Review',
  description: 'Must finish before submission window closes',
  task_type: 'assignment',
  status: 'planned',
  priority: 'critical',
  goal_id: null,
  milestone_id: null,
  goal_title: null,
  milestone_title: null,
  estimated_minutes: 60,
  actual_minutes: null,
  due_at: '2026-10-02T12:00:00.000Z',
  scheduled_start: null,
  scheduled_end: null,
  completed_at: null,
  notes: null,
  created_at: '2026-09-30T00:00:00.000Z',
  updated_at: '2026-09-30T00:00:00.000Z',
  is_blocked: true,
  blocking_task_count: 1,
  blocked_by: [{ id: '999', title: 'Blocking Setup Task', status: 'planned' }],
  metrics: {
    is_blocked: true,
    blocking_task_count: 1,
    blocked_by: [{ id: '999', title: 'Blocking Setup Task', status: 'planned' }],
  },
};

const mockCompletedTask: TaskDto = {
  id: '33333333-3333-3333-3333-333333333333',
  user_id: 'user_123',
  title: 'Morning Code Review',
  description: 'Reviewed pending PRs',
  task_type: 'project',
  status: 'completed',
  priority: 'medium',
  goal_id: null,
  milestone_id: null,
  goal_title: null,
  milestone_title: null,
  estimated_minutes: 30,
  actual_minutes: 45,
  due_at: null,
  scheduled_start: null,
  scheduled_end: null,
  completed_at: '2026-10-03T05:00:00.000Z',
  notes: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-03T05:00:00.000Z',
  is_blocked: false,
  blocking_task_count: 0,
  blocked_by: [],
  metrics: {
    is_blocked: false,
    blocking_task_count: 0,
    blocked_by: [],
  },
};

const mockTodayData: TodayResponse = {
  date: '2026-10-03',
  timezone: 'Asia/Kolkata',
  summary: {
    completedTaskCount: 1,
    meaningfulMinutes: 45,
    estimatedMinutesWithoutActual: 15,
    dailyMinimum: 30,
    dailyTarget: 120,
    maxDailyStudy: 240,
    minimumProgress: 100,
    targetProgress: 38,
  },
  next: mockNextTask,
  overdue: [mockOverdueTask],
  dueToday: [mockNextTask],
  scheduledToday: [],
  upcoming: [],
  completedToday: [mockCompletedTask],
};

function renderTodayPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TodayPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('TodayPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();

    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    vi.spyOn(tasksHooks, 'useTask').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof tasksHooks.useTask>);
  });

  it('renders Today header, progress metrics, and Next Up card', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: mockTodayData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    // Header
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText(/Asia\/Kolkata/)).toBeInTheDocument();

    // Progress
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('actual min')).toBeInTheDocument();
    expect(screen.getByText('+15m estimated')).toBeInTheDocument();
    expect(screen.getByText('1 task completed')).toBeInTheDocument();
    expect(screen.getByText('45/30m (100%)')).toBeInTheDocument();
    expect(screen.getByText('45/120m (38%)')).toBeInTheDocument();

    // Next Up card
    expect(screen.getByText('Next Up')).toBeInTheDocument();
    expect(screen.getAllByText('Implement Raft Consensus Algorithm').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Complete/i })[0]).toBeInTheDocument();
  }, 15000);

  it('renders Overdue, Due Today, and Completed Today sections', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: mockTodayData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    // Overdue section
    expect(screen.getByRole('heading', { level: 2, name: 'Overdue' })).toBeInTheDocument();
    expect(screen.getByText('Overdue Assignment Review')).toBeInTheDocument();
    expect(screen.getByText('Blocked (1)')).toBeInTheDocument();

    // Due Today section
    expect(screen.getByRole('heading', { level: 2, name: 'Due Today' })).toBeInTheDocument();

    // Completed Today section
    expect(screen.getByRole('heading', { level: 2, name: 'Completed Today' })).toBeInTheDocument();
    expect(screen.getByText('Morning Code Review')).toBeInTheDocument();
    expect(screen.getByText('45m actual')).toBeInTheDocument();
  });

  it('renders empty state when there are zero tasks for today', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: {
        ...mockTodayData,
        next: null,
        overdue: [],
        dueToday: [],
        scheduledToday: [],
        upcoming: [],
        completedToday: [],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    expect(screen.getByText('Nothing scheduled for today.')).toBeInTheDocument();
    expect(
      screen.getByText('Create a task or assign work to a goal to start building your day.')
    ).toBeInTheDocument();
  });

  it('renders all-completed state banner when all scheduled/due work is finished', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: {
        ...mockTodayData,
        next: null,
        overdue: [],
        dueToday: [],
        scheduledToday: [],
        upcoming: [],
        completedToday: [mockCompletedTask],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    expect(screen.getByText("You're done for today.")).toBeInTheDocument();
    expect(
      screen.getByText('All scheduled and due tasks have been successfully completed.')
    ).toBeInTheDocument();
  });

  it('renders loading skeleton when loading', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when query fails', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load Today data from server'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    expect(screen.getByText('Failed to load Today')).toBeInTheDocument();
    expect(screen.getByText('Failed to load Today data from server')).toBeInTheDocument();
  });

  it('opens CreateTaskModal when Create Task button is clicked', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: mockTodayData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    const createBtn = screen.getByRole('button', { name: /Create Task/i });
    fireEvent.click(createBtn);

    expect(
      screen.getByText('Define an executable unit of work linked to your growth plan.')
    ).toBeInTheDocument();
  });

  it('disables completion toggle for blocked tasks in Today sections with accessible explanation', () => {
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: mockTodayData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    renderTodayPage(queryClient);

    // Overdue task (mockOverdueTask) is blocked
    const blockedToggle = screen.getByRole('button', {
      name: 'Cannot complete: task has incomplete prerequisites',
    });
    expect(blockedToggle).toBeDisabled();
    expect(blockedToggle).toHaveAttribute(
      'title',
      'Cannot complete: task has incomplete prerequisites'
    );

    // Due today task (mockNextTask) is unblocked
    const unblockedToggle = screen.getByRole('button', {
      name: 'Mark task as completed',
    });
    expect(unblockedToggle).not.toBeDisabled();
    expect(unblockedToggle).toHaveAttribute('title', 'Mark task as completed');
  });
});
