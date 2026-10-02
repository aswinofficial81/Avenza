import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskDetailPage } from './TaskDetailPage';
import * as tasksHooks from '../features/tasks/useTasks';
import * as goalsHooks from '../features/goals/useGoals';
import type { TaskDetailDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockTaskDetail: TaskDetailDto = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: 'user_123',
  title: 'Implement Raft Consensus Algorithm',
  description: 'Build leader election and log replication logic',
  task_type: 'project',
  status: 'planned',
  priority: 'high',
  goal_id: 'goal-1',
  milestone_id: 'ms-1',
  goal_title: 'Master Distributed Systems',
  milestone_title: 'Consensus Engines',
  estimated_minutes: 180,
  actual_minutes: 45,
  due_at: '2026-10-15T00:00:00.000Z',
  scheduled_start: '2026-10-10T09:00:00.000Z',
  scheduled_end: '2026-10-10T12:00:00.000Z',
  completed_at: null,
  notes: 'Review Ongaro paper section 5',
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
  dependencies: [
    {
      id: 'dep-1',
      task_id: '11111111-1111-1111-1111-111111111111',
      depends_on_task_id: '22222222-2222-2222-2222-222222222222',
      prerequisite_title: 'Review RPC Framework',
      prerequisite_status: 'planned',
      created_at: '2026-10-01T00:00:00.000Z',
    },
  ],
  dependents: [],
};

function renderTaskDetailPage(queryClient: QueryClient, taskId = '11111111-1111-1111-1111-111111111111') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/tasks/${taskId}`]}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TaskDetailPage Component', () => {
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

    vi.spyOn(tasksHooks, 'useTaskDependencies').mockReturnValue({
      data: mockTaskDetail.dependencies,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTaskDependencies>);
  });

  it('renders task detail with title, description, estimates, and blocked banner', () => {
    vi.spyOn(tasksHooks, 'useTask').mockReturnValue({
      data: mockTaskDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTask>);

    renderTaskDetailPage(queryClient);

    expect(screen.getByRole('heading', { level: 1, name: 'Implement Raft Consensus Algorithm' })).toBeInTheDocument();
    expect(screen.getByText('Build leader election and log replication logic')).toBeInTheDocument();
    expect(screen.getByText('180 min')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Review Ongaro paper section 5')).toBeInTheDocument();
    expect(screen.getByText(/Execution Blocked — waiting for 1 task/i)).toBeInTheDocument();
    expect(screen.getByText('Review RPC Framework')).toBeInTheDocument();
  });

  it('renders strategic alignment with parent goal and milestone', () => {
    vi.spyOn(tasksHooks, 'useTask').mockReturnValue({
      data: mockTaskDetail,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTask>);

    renderTaskDetailPage(queryClient);

    expect(screen.getByText('Master Distributed Systems')).toBeInTheDocument();
    expect(screen.getByText('Consensus Engines')).toBeInTheDocument();
  });

  it('renders loading state when task is loading', () => {
    vi.spyOn(tasksHooks, 'useTask').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTask>);

    renderTaskDetailPage(queryClient);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state when task is not found', () => {
    vi.spyOn(tasksHooks, 'useTask').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Task not found'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTask>);

    renderTaskDetailPage(queryClient);

    expect(screen.getAllByText('Task not found').length).toBeGreaterThanOrEqual(1);
  });
});
