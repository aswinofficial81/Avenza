/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import * as projectHooks from './hooks/useProjects';
import * as taskHooks from '../tasks/useTasks';
import * as integrationHooks from '../integrations/hooks/useIntegrations';
import * as intelligenceHooks from '../intelligence/useNextAction';
import type { ProjectDetailDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockProjectDetail: ProjectDetailDto = {
  id: 'proj-101',
  user_id: 'user-1',
  title: 'Consensus Engine Alpha',
  slug: 'consensus-engine-alpha',
  description: 'High-throughput fault tolerant Raft consensus engine',
  status: 'in_progress',
  priority: 'high',
  project_type: 'software',
  repository_id: 'repo-101',
  start_date: '2026-10-01T00:00:00Z',
  target_date: '2026-12-31T00:00:00Z',
  completed_at: null,
  live_url: 'https://raft.avenza.io',
  architecture_notes: 'Log replication with rocksdb backend',
  tech_stack: ['Rust', 'Tokio', 'RocksDB'],
  metadata: {},
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-05T00:00:00Z',
  metrics: {
    milestoneCount: 2,
    completedMilestoneCount: 1,
    progressPercentage: 50,
    taskCount: 2,
    completedTaskCount: 1,
    healthStatus: 'on_track',
    healthReason: 'Progress is on track.',
  },
  milestones: [
    {
      id: 'm-1',
      project_id: 'proj-101',
      user_id: 'user-1',
      title: 'Phase 1: Leader Election',
      description: 'Heartbeat timers and election RPCs',
      status: 'completed',
      order_index: 0,
      target_date: '2026-10-15T00:00:00Z',
      completed_at: '2026-10-05T00:00:00Z',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    },
    {
      id: 'm-2',
      project_id: 'proj-101',
      user_id: 'user-1',
      title: 'Phase 2: Log Replication',
      description: 'AppendEntries RPC and commit index tracking',
      status: 'in_progress',
      order_index: 1,
      target_date: '2026-11-15T00:00:00Z',
      completed_at: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    },
  ],
  tasks: [
    {
      id: 't-1',
      user_id: 'user-1',
      title: 'Implement Raft Heartbeat Timer',
      description: 'Randomized election timer logic',
      status: 'completed',
      priority: 'high',
      task_type: 'project',
      goal_id: null,
      milestone_id: null,
      project_id: 'proj-101',
      project_milestone_id: 'm-1',
      project_title: 'Consensus Engine Alpha',
      project_milestone_title: 'Phase 1: Leader Election',
      estimated_minutes: 90,
      actual_minutes: 80,
      due_at: '2026-10-10T00:00:00Z',
      scheduled_start: null,
      scheduled_end: null,
      completed_at: '2026-10-04T00:00:00Z',
      notes: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-04T00:00:00Z',
      is_blocked: false,
      blocking_task_count: 0,
      blocked_by: [],
      metrics: { is_blocked: false, blocking_task_count: 0, blocked_by: [] },
    },
    {
      id: 't-2',
      user_id: 'user-1',
      title: 'Implement Log Compaction Snapshotting',
      description: 'Write snapshots to disk and truncate log',
      status: 'in_progress',
      priority: 'critical',
      task_type: 'project',
      goal_id: null,
      milestone_id: null,
      project_id: 'proj-101',
      project_milestone_id: 'm-2',
      project_title: 'Consensus Engine Alpha',
      project_milestone_title: 'Phase 2: Log Replication',
      estimated_minutes: 120,
      actual_minutes: null,
      due_at: '2026-11-01T00:00:00Z',
      scheduled_start: null,
      scheduled_end: null,
      completed_at: null,
      notes: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
      is_blocked: false,
      blocking_task_count: 0,
      blocked_by: [],
      metrics: { is_blocked: false, blocking_task_count: 0, blocked_by: [] },
    },
  ],
  goals: [],
  skills: [],
  repository: {
    id: 'repo-101',
    connection_id: 'conn-1',
    provider: 'github',
    external_id: '999888',
    name: 'raft-rs',
    full_name: 'alice/raft-rs',
    owner: 'alice',
    description: 'Rust implementation of Raft',
    html_url: 'https://github.com/alice/raft-rs',
    default_branch: 'main',
    is_private: false,
    stars_count: 42,
    forks_count: 7,
    open_issues_count: 3,
    primary_language: 'Rust',
    languages: { Rust: 1000 },
    pushed_at: '2026-10-05T00:00:00Z',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z',
  },
  activities: [],
};

function createWrapper(initialEntries = ['/projects/proj-101']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/projects/:id" element={children} />
          <Route path="/projects" element={<div>Projects Overview Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Phase 15E: Project Detail UX & Polished Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(projectHooks, 'useProject').mockReturnValue({
      data: mockProjectDetail,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(integrationHooks, 'useIntegrationStatus').mockReturnValue({
      data: { connection: { status: 'CONNECTED' } },
      isLoading: false,
    } as any);
  });

  it('renders compact header with title, badges, live link, and metrics widget', () => {
    render(<ProjectDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Consensus Engine Alpha' })).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/high priority/i)).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('Live App')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();

    // Metrics widget
    expect(screen.getByText('Project Progress')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getAllByText('1/2').length).toBe(2); // Milestones and Tasks
  });

  it('preserves and switches tabs with URL synchronization', () => {
    render(<ProjectDetailPage />, {
      wrapper: createWrapper(['/projects/proj-101?tab=milestones']),
    });

    expect(screen.getByRole('tab', { name: /Milestones/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('heading', { name: 'Project Milestones' })).toBeInTheDocument();

    // Click Tasks tab
    const tasksTab = screen.getByRole('tab', { name: /Tasks/i });
    fireEvent.click(tasksTab);

    expect(screen.getByRole('heading', { name: 'Project Tasks' })).toBeInTheDocument();
  });

  it('renders overview tab with tech stack, diagnostic details, and architecture notes', () => {
    render(<ProjectDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Technology Stack' })).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('Tokio')).toBeInTheDocument();
    expect(screen.getByText('RocksDB')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Health & Pacing' })).toBeInTheDocument();
    expect(screen.getByText('Progress is on track.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Architecture Notes' })).toBeInTheDocument();
    expect(screen.getByText(/Log replication with rocksdb backend/i)).toBeInTheDocument();
  });

  it('renders recommended next task card in Overview tab when intelligence matches project', () => {
    vi.spyOn(intelligenceHooks, 'useNextAction').mockReturnValue({
      data: {
        action: {
          type: 'focus_task',
          taskId: 'task-101',
          title: 'Implement Raft Heartbeat Timer',
          score: 85,
          projectId: 'proj-101',
          projectTitle: 'Consensus Engine Alpha',
        },
        reason: {
          code: 'project_at_risk',
          label: 'Project at risk',
          explanation: 'Your Consensus Engine Alpha project is at risk and this task belongs to its next milestone.',
        },
        confidence: 'high',
        generatedAt: '2026-10-08T12:00:00Z',
        scoreBreakdown: null,
      },
      isLoading: false,
      error: null,
    } as any);

    render(<ProjectDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('recommended-project-task')).toBeInTheDocument();
    expect(screen.getByText('Recommended Next Task')).toBeInTheDocument();
    expect(screen.getByText('Implement Raft Heartbeat Timer')).toBeInTheDocument();
  });

  it('opens Edit Project modal, allows modifying fields, and calls mutation', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({
      ...mockProjectDetail,
      title: 'Consensus Engine Beta',
    });

    vi.spyOn(projectHooks, 'useUpdateProject').mockReturnValue({
      mutateAsync: mockUpdate,
      isPending: false,
    } as any);

    render(<ProjectDetailPage />, { wrapper: createWrapper() });

    const editBtn = screen.getByTestId('edit-project-btn');
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Edit Project' })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Project Title/i);
    expect((titleInput as HTMLInputElement).value).toBe('Consensus Engine Alpha');

    fireEvent.change(titleInput, { target: { value: 'Consensus Engine Beta' } });

    const form = screen.getByTestId('project-form');
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Consensus Engine Beta',
        })
      );
    });
  });

  it('provides a deliberate delete confirmation dialog and triggers deletion', async () => {
    const mockDelete = vi.fn().mockResolvedValue({ deleted: true });

    vi.spyOn(projectHooks, 'useDeleteProject').mockReturnValue({
      mutateAsync: mockDelete,
      isPending: false,
    } as any);

    render(<ProjectDetailPage />, { wrapper: createWrapper() });

    const deleteBtn = screen.getByTestId('delete-project-btn');
    fireEvent.click(deleteBtn);

    // Confirmation dialog open
    expect(screen.getByRole('heading', { name: 'Delete Project Workspace' })).toBeInTheDocument();
    expect(
      screen.getByText(/Deleting the project removes its project milestones and project relationships/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Existing tasks are preserved in your workspace but become unlinked/i)
    ).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: 'Delete Project' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('proj-101');
    });
  });

  it('renders milestones tab with ordered milestones and task counts', () => {
    render(<ProjectDetailPage />, {
      wrapper: createWrapper(['/projects/proj-101?tab=milestones']),
    });

    expect(screen.getByText('Phase 1: Leader Election')).toBeInTheDocument();
    expect(screen.getByText('Phase 2: Log Replication')).toBeInTheDocument();

    // Task count indicators
    expect(screen.getAllByText(/1 task/i).length).toBeGreaterThanOrEqual(1);
  });

  it('supports completing, skipping, and deleting milestones', async () => {
    const mockUpdateMilestone = vi.fn().mockResolvedValue({});
    const mockDeleteMilestone = vi.fn().mockResolvedValue({});

    vi.spyOn(projectHooks, 'useUpdateProjectMilestone').mockReturnValue({
      mutateAsync: mockUpdateMilestone,
      isPending: false,
    } as any);

    vi.spyOn(projectHooks, 'useDeleteProjectMilestone').mockReturnValue({
      mutateAsync: mockDeleteMilestone,
      isPending: false,
    } as any);

    render(<ProjectDetailPage />, {
      wrapper: createWrapper(['/projects/proj-101?tab=milestones']),
    });

    // Milestone 2 is in_progress, so it has Complete and Skip buttons
    const completeBtns = screen.getAllByRole('button', { name: /Complete milestone/i });
    fireEvent.click(completeBtns[0]!);

    await waitFor(() => {
      expect(mockUpdateMilestone).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'm-2',
          data: expect.objectContaining({ status: 'completed' }),
        })
      );
    });

    // Skip action
    const skipBtns = screen.getAllByRole('button', { name: /Skip milestone/i });
    fireEvent.click(skipBtns[0]!);

    await waitFor(() => {
      expect(mockUpdateMilestone).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'm-2',
          data: expect.objectContaining({ status: 'skipped' }),
        })
      );
    });

    // Delete milestone
    const deleteBtns = screen.getAllByRole('button', { name: /Delete milestone/i });
    fireEvent.click(deleteBtns[0]!);

    expect(screen.getByRole('heading', { name: 'Delete Milestone' })).toBeInTheDocument();
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete Milestone' });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockDeleteMilestone).toHaveBeenCalled();
    });
  });

  it('renders tasks tab with universal tasks, completion toggle, and milestone link', async () => {
    const mockUpdateTask = vi.fn().mockResolvedValue({});
    vi.spyOn(taskHooks, 'useUpdateTask').mockReturnValue({
      mutateAsync: mockUpdateTask,
      isPending: false,
    } as any);

    render(<ProjectDetailPage />, {
      wrapper: createWrapper(['/projects/proj-101?tab=tasks']),
    });

    expect(screen.getByText('Implement Raft Heartbeat Timer')).toBeInTheDocument();
    expect(screen.getByText('Implement Log Compaction Snapshotting')).toBeInTheDocument();

    // Associated milestone chip
    expect(screen.getByText('Phase 1: Leader Election')).toBeInTheDocument();

    // Toggle completion on task 2
    const checkBtn = screen.getByRole('button', { name: 'Mark completed' });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });
  });

  it('renders without error under dark mode theme class', () => {
    const { container } = render(
      <div className="dark bg-background text-foreground">
        <ProjectDetailPage />
      </div>,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector('.dark')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consensus Engine Alpha' })).toBeInTheDocument();
  });
});
