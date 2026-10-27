/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectsOverviewPage } from './pages/ProjectsOverviewPage';
import { ProjectCard } from './components/ProjectCard';
import * as projectHooks from './hooks/useProjects';
import type { ProjectDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockProjects: ProjectDto[] = [
  {
    id: 'proj-1',
    user_id: 'user-1',
    title: 'Distributed Consensus Engine',
    slug: 'consensus-engine',
    description: 'Raft algorithm implementation in Rust with snapshotting',
    status: 'in_progress',
    priority: 'high',
    project_type: 'software',
    repository_id: 'repo-1',
    start_date: '2026-10-01T00:00:00Z',
    target_date: '2026-12-01T00:00:00Z',
    completed_at: null,
    live_url: 'https://raft.example.com',
    architecture_notes: 'Multi-node quorum with gRPC transport',
    tech_stack: ['Rust', 'gRPC', 'Tokio'],
    metadata: {},
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-05T00:00:00Z',
    metrics: {
      milestoneCount: 4,
      completedMilestoneCount: 2,
      progressPercentage: 50,
      taskCount: 12,
      completedTaskCount: 6,
      healthStatus: 'on_track',
      healthReason: 'Progress is on track.',
    },
  },
  {
    id: 'proj-2',
    user_id: 'user-1',
    title: 'Quantum Key Distribution Simulator',
    slug: 'qkd-simulator',
    description: 'BB84 simulation and eavesdropping interception model',
    status: 'planning',
    priority: 'critical',
    project_type: 'research',
    repository_id: null,
    start_date: '2026-10-10T00:00:00Z',
    target_date: '2026-11-15T00:00:00Z',
    completed_at: null,
    live_url: null,
    architecture_notes: null,
    tech_stack: ['Python', 'NumPy'],
    metadata: {},
    created_at: '2026-10-02T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z',
    metrics: {
      milestoneCount: 3,
      completedMilestoneCount: 0,
      progressPercentage: 10,
      taskCount: 5,
      completedTaskCount: 0,
      healthStatus: 'at_risk',
      healthReason: 'Milestone 1 is overdue.',
    },
  },
];

function createWrapper(initialEntries = ['/projects']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/projects" element={children} />
          <Route path="/projects/:id" element={<div>Project Detail View</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Phase 15E: Projects Overview & Cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview header with title, description, and create project button', () => {
    vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: {
        data: mockProjects,
        pagination: { total: 2, page: 1, pageSize: 12, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ProjectsOverviewPage />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(
      screen.getByText(/Technical project workspaces, feature roadmaps, and dev milestones/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('create-project-btn')).toBeInTheDocument();
  });

  it('renders project cards with clean hierarchy, badges, metrics, and github indicator', () => {
    const singleProj = mockProjects[0]!;
    render(<ProjectCard project={singleProj} />, { wrapper: createWrapper() });

    expect(screen.getByText('Distributed Consensus Engine')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('software')).toBeInTheDocument();
    expect(screen.getByText(/Raft algorithm implementation/i)).toBeInTheDocument();

    // Metrics
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2/4 milestones')).toBeInTheDocument();
    expect(screen.getByText('6/12 tasks')).toBeInTheDocument();
    expect(screen.getByText(/Target:/i)).toBeInTheDocument();

    // Tech stack chips
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('gRPC')).toBeInTheDocument();
    expect(screen.getByText('Tokio')).toBeInTheDocument();

    // GitHub linked indicator
    expect(screen.getByTitle('GitHub repository linked')).toBeInTheDocument();
  });

  it('renders loading skeleton cards when query is loading', () => {
    vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ProjectsOverviewPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('projects-loading-grid')).toBeInTheDocument();
    const skeletons = screen.getAllByTestId('project-card-skeleton');
    expect(skeletons.length).toBe(6);
  });

  it('renders error state with retry button when query fails', () => {
    const mockRefetch = vi.fn();
    vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Database connection failed'),
      refetch: mockRefetch,
    } as any);

    render(<ProjectsOverviewPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('projects-error-state')).toBeInTheDocument();
    expect(screen.getByText(/Failed to load projects/i)).toBeInTheDocument();
    expect(screen.getByText('Database connection failed')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('renders useful empty state when no projects exist yet with CTA', () => {
    vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: {
        data: [],
        pagination: { total: 0, page: 1, pageSize: 12, totalPages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ProjectsOverviewPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('projects-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Create your first project to start tracking what you're building/i)
    ).toBeInTheDocument();
  });

  it('renders filtered empty state with clear filters CTA when filters yield no matches', () => {
    vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: {
        data: [],
        pagination: { total: 0, page: 1, pageSize: 12, totalPages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // Render with active filter
    render(<ProjectsOverviewPage />, {
      wrapper: createWrapper(['/projects?status=archived']),
    });

    expect(screen.getByText('No matching projects')).toBeInTheDocument();
    expect(
      screen.getByText('No projects match your current search and filter criteria.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
  });

  it('updates search, status, priority, type, and sort filters via controls', async () => {
    const useProjectsSpy = vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: {
        data: mockProjects,
        pagination: { total: 2, page: 1, pageSize: 12, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ProjectsOverviewPage />, { wrapper: createWrapper() });

    // 1. Status Filter
    const statusSelect = screen.getByTestId('project-status-filter');
    fireEvent.change(statusSelect, { target: { value: 'in_progress' } });

    // 2. Priority Filter
    const prioritySelect = screen.getByTestId('project-priority-filter');
    fireEvent.change(prioritySelect, { target: { value: 'high' } });

    // 3. Project Type Filter
    const typeSelect = screen.getByTestId('project-type-filter');
    fireEvent.change(typeSelect, { target: { value: 'software' } });

    // 4. Sort Select
    const sortSelect = screen.getByTestId('project-sort-select');
    fireEvent.change(sortSelect, { target: { value: 'target_date_asc' } });

    // 5. Search Input
    const searchInput = screen.getByTestId('project-search-input');
    fireEvent.change(searchInput, { target: { value: 'consensus' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(useProjectsSpy).toHaveBeenCalled();
    });
  });

  it('opens Create Project modal, validates inputs, and triggers creation mutation', async () => {
    vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: {
        data: mockProjects,
        pagination: { total: 2, page: 1, pageSize: 12, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const mockMutateAsync = vi.fn().mockResolvedValue({
      id: 'proj-new',
      title: 'Real-time Telemetry Service',
      slug: 'telemetry-service',
      status: 'in_progress',
      priority: 'high',
      project_type: 'software',
    });

    vi.spyOn(projectHooks, 'useCreateProject').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    render(<ProjectsOverviewPage />, { wrapper: createWrapper() });

    const createBtn = screen.getByTestId('create-project-btn');
    fireEvent.click(createBtn);

    // Modal is open
    expect(screen.getByRole('heading', { name: 'Create Project' })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Project Title/i);
    const slugInput = screen.getByLabelText(/Slug/i);

    // Auto-generates slug from title
    fireEvent.change(titleInput, { target: { value: 'Real-time Telemetry Service' } });
    expect((slugInput as HTMLInputElement).value).toBe('real-time-telemetry-service');

    // Add a tech stack item
    const techInput = screen.getByPlaceholderText(/Add technology/i);
    fireEvent.change(techInput, { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('button', { name: /Add/i }));

    expect(screen.getByText('Go')).toBeInTheDocument();

    // Submit form scoped to modal
    const form = screen.getByTestId('project-form');
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Real-time Telemetry Service',
          slug: 'real-time-telemetry-service',
          project_type: 'software',
          tech_stack: ['Go'],
        })
      );
    });
  });

  it('validates target date on or after start date in ProjectFormModal', async () => {
    vi.spyOn(projectHooks, 'useProjects').mockReturnValue({
      data: {
        data: [],
        pagination: { total: 0, page: 1, pageSize: 12, totalPages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ProjectsOverviewPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId('create-project-btn'));

    const titleInput = screen.getByLabelText(/Project Title/i);
    fireEvent.change(titleInput, { target: { value: 'Invalid Date Project' } });

    const startDateInput = screen.getByLabelText(/Start Date/i);
    const targetDateInput = screen.getByLabelText(/Target Date/i);

    fireEvent.change(startDateInput, { target: { value: '2026-12-01' } });
    fireEvent.change(targetDateInput, { target: { value: '2026-10-01' } }); // Before start date

    const form = screen.getByTestId('project-form');
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Target date must be on or after start date')
    ).toBeInTheDocument();
  });
});
