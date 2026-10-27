import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TasksPage } from './TasksPage';
import * as tasksHooks from '../features/tasks/useTasks';
import * as goalsHooks from '../features/goals/useGoals';
import type { TaskDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockTasks: TaskDto[] = [
  {
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
    actual_minutes: 60,
    due_at: '2026-10-15T00:00:00.000Z',
    scheduled_start: '2026-10-10T09:00:00.000Z',
    scheduled_end: '2026-10-10T12:00:00.000Z',
    completed_at: null,
    notes: 'See Ongaro paper',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    is_blocked: true,
    blocking_task_count: 1,
    blocked_by: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Review RPC Framework',
        status: 'planned',
      },
    ],
    metrics: {
      is_blocked: true,
      blocking_task_count: 1,
      blocked_by: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          title: 'Review RPC Framework',
          status: 'planned',
        },
      ],
    },
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    user_id: 'user_123',
    title: 'Review RPC Framework',
    description: null,
    task_type: 'study',
    status: 'planned',
    priority: 'medium',
    goal_id: null,
    milestone_id: null,
    goal_title: null,
    milestone_title: null,
    estimated_minutes: 45,
    actual_minutes: null,
    due_at: null,
    scheduled_start: null,
    scheduled_end: null,
    completed_at: null,
    notes: null,
    created_at: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-02T00:00:00.000Z',
    is_blocked: false,
    blocking_task_count: 0,
    blocked_by: [],
    metrics: {
      is_blocked: false,
      blocking_task_count: 0,
      blocked_by: [],
    },
  },
];

function renderTasksPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TasksPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('TasksPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();

    // Default mock for goals
    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: {
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    vi.spyOn(tasksHooks, 'useTask').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof tasksHooks.useTask>);
  });

  it('renders tasks list with badges, titles, estimates, and blocked status', () => {
    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: {
        data: mockTasks,
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    renderTasksPage(queryClient);

    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByText('Implement Raft Consensus Algorithm')).toBeInTheDocument();
    expect(screen.getByText('Review RPC Framework')).toBeInTheDocument();
    expect(screen.getByText('Blocked (1)')).toBeInTheDocument();
    expect(screen.getByText('180m est')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no tasks exist', () => {
    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: {
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    renderTasksPage(queryClient);

    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(
      screen.getByText('Create your first task to turn a goal into executable work.')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Create Task/i })[0]).toBeInTheDocument();
  });

  it('renders loading state when query is loading', () => {
    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    renderTasksPage(queryClient);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when query fails', () => {
    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load tasks from server'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    renderTasksPage(queryClient);

    expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
    expect(screen.getByText('Failed to load tasks from server')).toBeInTheDocument();
  });

  it('opens CreateTaskModal when Create Task button is clicked', () => {
    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: {
        data: mockTasks,
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    renderTasksPage(queryClient);

    const createBtn = screen.getByRole('button', { name: /Create Task/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('Define an executable unit of work linked to your growth plan.')).toBeInTheDocument();
  });

  it('disables completion toggle for blocked tasks and enables it for unblocked tasks', () => {
    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: {
        data: mockTasks,
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    renderTasksPage(queryClient);

    // mockTasks[0] is blocked
    const blockedToggle = screen.getByRole('button', {
      name: 'Cannot complete: task has incomplete prerequisites',
    });
    expect(blockedToggle).toBeDisabled();
    expect(blockedToggle).toHaveAttribute(
      'title',
      'Cannot complete: task has incomplete prerequisites'
    );

    // mockTasks[1] is not blocked
    const unblockedToggle = screen.getByRole('button', {
      name: 'Mark task completed',
    });
    expect(unblockedToggle).not.toBeDisabled();
    expect(unblockedToggle).toHaveAttribute('title', 'Mark task completed');
  });
});
