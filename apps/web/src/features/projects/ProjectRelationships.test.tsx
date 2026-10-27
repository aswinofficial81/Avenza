import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectGoalsSection } from './components/ProjectGoalsSection';
import { ProjectSkillsSection } from './components/ProjectSkillsSection';
import { ProjectRepositorySection } from './components/ProjectRepositorySection';
import { ProjectActivityTimeline } from './components/ProjectActivityTimeline';
import { LinkGoalModal } from './components/LinkGoalModal';
import { LinkSkillModal } from './components/LinkSkillModal';
import { LinkRepositoryModal } from './components/LinkRepositoryModal';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import * as projectHooks from './hooks/useProjects';
import * as integrationHooks from '../integrations/hooks/useIntegrations';
import * as goalHooks from '../goals/useGoals';
import * as skillHooks from '../skills/useSkills';
import type {
  ExternalRepositoryDto,
  ProjectDetailDto,
  SkillWithMasteryDto,
} from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/proj-123']}>
        <Routes>
          <Route path="/projects/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockProjectDetail: ProjectDetailDto = {
  id: 'proj-123',
  user_id: 'user-alice',
  title: 'Avenza Core Engine',
  slug: 'avenza-core-engine',
  description: 'Personal execution operating system',
  status: 'in_progress',
  priority: 'high',
  project_type: 'software',
  repository_id: 'repo-456',
  start_date: '2026-10-01T00:00:00Z',
  target_date: '2026-12-31T00:00:00Z',
  completed_at: null,
  live_url: 'https://avenza.dev',
  architecture_notes: 'Fastify + React + Tailwind tokens',
  tech_stack: ['TypeScript', 'Fastify', 'React'],
  metadata: {},
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-06T00:00:00Z',
  metrics: {
    milestoneCount: 4,
    completedMilestoneCount: 2,
    progressPercentage: 50,
    taskCount: 10,
    completedTaskCount: 5,
    healthStatus: 'on_track',
    healthReason: 'Progress is on track.',
  },
  milestones: [
    {
      id: 'm-1',
      project_id: 'proj-123',
      user_id: 'user-alice',
      title: 'Phase 1: Architecture Core',
      description: 'Foundations and DB',
      status: 'completed',
      order_index: 0,
      target_date: '2026-10-15T00:00:00Z',
      completed_at: '2026-10-05T00:00:00Z',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    },
  ],
  tasks: [
    {
      id: 't-1',
      user_id: 'user-alice',
      title: 'Implement Project Execution DB',
      description: 'Tables and RLS',
      status: 'completed',
      priority: 'high',
      task_type: 'project',
      goal_id: null,
      milestone_id: null,
      project_id: 'proj-123',
      project_milestone_id: 'm-1',
      project_title: 'Avenza Core Engine',
      project_milestone_title: 'Phase 1: Architecture Core',
      estimated_minutes: 60,
      actual_minutes: 45,
      due_at: null,
      scheduled_start: null,
      scheduled_end: null,
      completed_at: '2026-10-05T00:00:00Z',
      notes: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
      is_blocked: false,
      blocking_task_count: 0,
      blocked_by: [],
      metrics: {
        is_blocked: false,
        blocking_task_count: 0,
        blocked_by: [],
      },
    },
  ],
  goals: [
    {
      project_id: 'proj-123',
      goal_id: 'goal-primary-1',
      user_id: 'user-alice',
      is_primary: true,
      created_at: '2026-10-01T00:00:00Z',
      goal_title: 'Launch Avenza 1.0',
    },
    {
      project_id: 'proj-123',
      goal_id: 'goal-secondary-2',
      user_id: 'user-alice',
      is_primary: false,
      created_at: '2026-10-02T00:00:00Z',
      goal_title: 'Sub-100ms API Latency',
    },
  ],
  skills: [
    {
      project_id: 'proj-123',
      skill_id: 'skill-ts-1',
      user_id: 'user-alice',
      role: 'primary',
      created_at: '2026-10-01T00:00:00Z',
      skill_name: 'TypeScript Engineering',
      skill_slug: 'typescript-engineering',
    },
    {
      project_id: 'proj-123',
      skill_id: 'skill-pg-2',
      user_id: 'user-alice',
      role: 'supporting',
      created_at: '2026-10-02T00:00:00Z',
      skill_name: 'PostgreSQL Database',
      skill_slug: 'postgresql-database',
    },
  ],
  repository: {
    id: 'repo-456',
    connection_id: 'conn-gh-1',
    provider: 'github',
    external_id: 'gh-123',
    name: 'avenza',
    full_name: 'alice/avenza',
    owner: 'alice',
    is_private: false,
    html_url: 'https://github.com/alice/avenza',
    description: 'Personal Operating System monorepo',
    default_branch: 'main',
    primary_language: 'TypeScript',
    languages: { TypeScript: 85, SQL: 15 },
    stars_count: 120,
    forks_count: 14,
    open_issues_count: 3,
    pushed_at: '2026-10-06T15:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-10-06T15:00:00Z',
  },
  activities: [
    {
      id: 'act-1',
      connection_id: 'conn-gh-1',
      repository_id: 'repo-456',
      provider: 'github',
      external_id: 'c-101',
      activity_type: 'commit',
      occurred_at: '2026-10-06T14:30:00Z',
      title: 'feat: add projects relationship layer',
      summary: 'Connected goals, skills, and external repo signals',
      external_url: 'https://github.com/alice/avenza/commit/c-101',
      metadata: { branch: 'main' },
      created_at: '2026-10-06T14:35:00Z',
      updated_at: '2026-10-06T14:35:00Z',
    },
  ],
};

describe('Phase 15D Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Project Goals Section
  it('renders Project Goals section with title, primary badge, and action buttons', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectGoalsSection
          projectId="proj-123"
          goals={mockProjectDetail.goals}
        />
      </Wrapper>
    );

    expect(screen.getByText('Project Goals')).toBeInTheDocument();
    expect(screen.getByText('Launch Avenza 1.0')).toBeInTheDocument();
    expect(screen.getByText('Sub-100ms API Latency')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Unset Primary')).toBeInTheDocument();
    expect(screen.getByText('Set as Primary')).toBeInTheDocument();
  });

  // 2. Project Skills Section
  it('renders Project Skills section with roles and domain mastery', () => {
    vi.spyOn(skillHooks, 'useSkills').mockReturnValue({
      data: [
        {
          skill: {
            id: 'skill-ts-1',
            user_id: 'user-alice',
            parent_skill_id: null,
            name: 'TypeScript Engineering',
            slug: 'typescript-engineering',
            description: null,
            category: 'Languages',
            status: 'active',
            source: 'user',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          mastery: {
            state: 'proficient',
            score: 88,
            confidence: 'high',
            evidence_count: 24,
            verified_evidence_count: 18,
            health: 'healthy',
            explanation: 'Consistent commit proof',
            calculated_at: '2026-10-06T00:00:00Z',
            recent_activity_at: '2026-10-06T00:00:00Z',
          },
        },
      ] as SkillWithMasteryDto[],
      isLoading: false,
    } as unknown as ReturnType<typeof skillHooks.useSkills>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectSkillsSection
          projectId="proj-123"
          skills={mockProjectDetail.skills}
        />
      </Wrapper>
    );

    expect(screen.getByText('Project Skills')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Engineering')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL Database')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('Make Supporting')).toBeInTheDocument();
    expect(screen.getByText('Make Primary')).toBeInTheDocument();
  });

  // 3. Repository Section
  it('renders Repository section with repository details, stars, and default branch', () => {
    vi.spyOn(integrationHooks, 'useIntegrationStatus').mockReturnValue({
      data: {
        provider: 'github',
        connection: {
          id: 'conn-1',
          user_id: 'user-alice',
          provider: 'github',
          status: 'CONNECTED',
          auth_type: 'oauth',
          account_identifier: 'alice',
          metadata: {},
          last_synced_at: '2026-10-06T15:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-10-06T15:00:00Z',
        },
        supported_features: ['repositories', 'activities'],
        recent_sync_jobs: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof integrationHooks.useIntegrationStatus>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectRepositorySection
          projectId="proj-123"
          repository={mockProjectDetail.repository}
        />
      </Wrapper>
    );

    expect(screen.getByText('alice/avenza')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Open on GitHub')).toBeInTheDocument();
    expect(screen.getByText('Change Repository')).toBeInTheDocument();
  });

  // 4. Activity Timeline
  it('renders Activity Timeline displaying external commit signals and read-only notice', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectActivityTimeline
          activities={mockProjectDetail.activities}
          hasRepository={true}
        />
      </Wrapper>
    );

    expect(screen.getByText('Contextual Signals:')).toBeInTheDocument();
    expect(screen.getByText(/read only/i)).toBeInTheDocument();
    expect(screen.getByText('feat: add projects relationship layer')).toBeInTheDocument();
    expect(
      screen.getByText('Connected goals, skills, and external repo signals')
    ).toBeInTheDocument();
  });

  // 5. Empty Goals State
  it('renders EmptyState when no goals are attached', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectGoalsSection projectId="proj-123" goals={[]} />
      </Wrapper>
    );

    expect(screen.getByText('No Goals Attached')).toBeInTheDocument();
  });

  // 6. Empty Skills State
  it('renders EmptyState when no skills are attached', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectSkillsSection projectId="proj-123" skills={[]} />
      </Wrapper>
    );

    expect(screen.getByText('No Skills Attached')).toBeInTheDocument();
  });

  // 7. Disconnected GitHub State
  it('renders non-blocking GitHub Disconnected banner when status is not connected', () => {
    vi.spyOn(integrationHooks, 'useIntegrationStatus').mockReturnValue({
      data: {
        provider: 'github',
        connection: null,
        supported_features: ['repositories', 'activities'],
        recent_sync_jobs: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof integrationHooks.useIntegrationStatus>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectRepositorySection projectId="proj-123" repository={null} />
      </Wrapper>
    );

    expect(screen.getByText('GitHub Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Connect GitHub')).toBeInTheDocument();
  });

  // 8. Repository Linking Modal
  it('opens LinkRepositoryModal and displays available synced repositories', () => {
    vi.spyOn(integrationHooks, 'useIntegrationStatus').mockReturnValue({
      data: {
        provider: 'github',
        connection: {
          id: 'conn-1',
          user_id: 'user-alice',
          provider: 'github',
          status: 'CONNECTED',
          auth_type: 'oauth',
          account_identifier: 'alice',
          metadata: {},
          last_synced_at: null,
          created_at: '',
          updated_at: '',
        },
        supported_features: [],
        recent_sync_jobs: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof integrationHooks.useIntegrationStatus>);

    vi.spyOn(integrationHooks, 'useIntegrationRepositories').mockReturnValue({
      data: [
        {
          id: 'repo-repo-999',
          connection_id: 'conn-1',
          provider: 'github',
          external_id: 'gh-999',
          name: 'cloud-infra',
          full_name: 'alice/cloud-infra',
          owner: 'alice',
          is_private: true,
          html_url: 'https://github.com/alice/cloud-infra',
          description: 'Terraform modules',
          default_branch: 'main',
          primary_language: 'HCL',
          languages: {},
          stars_count: 5,
          forks_count: 0,
          open_issues_count: 0,
          pushed_at: null,
          created_at: '',
          updated_at: '',
        },
      ] as ExternalRepositoryDto[],
      isLoading: false,
    } as unknown as ReturnType<typeof integrationHooks.useIntegrationRepositories>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <LinkRepositoryModal
          isOpen={true}
          onClose={vi.fn()}
          projectId="proj-123"
        />
      </Wrapper>
    );

    expect(screen.getByText('Link GitHub Repository')).toBeInTheDocument();
    expect(screen.getByText(/alice\/cloud-infra/)).toBeInTheDocument();
  });

  // 9. Goal Linking Modal
  it('opens LinkGoalModal and displays selectable unlinked goals', () => {
    vi.spyOn(goalHooks, 'useGoals').mockReturnValue({
      data: {
        data: [
          {
            id: 'goal-unlinked-1',
            user_id: 'user-alice',
            title: 'Complete System Design Course',
            goal_type: 'learning',
            status: 'active',
            priority: 'medium',
            start_date: null,
            target_date: null,
            completed_at: null,
            created_at: '',
            updated_at: '',
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof goalHooks.useGoals>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <LinkGoalModal
          isOpen={true}
          onClose={vi.fn()}
          projectId="proj-123"
          existingGoals={mockProjectDetail.goals}
        />
      </Wrapper>
    );

    expect(screen.getByText('Link Goal to Project')).toBeInTheDocument();
    expect(screen.getByText('Mark as Primary Goal')).toBeInTheDocument();
    expect(screen.getByText(/Complete System Design Course/)).toBeInTheDocument();
  });

  // 10. Skill Linking Modal
  it('opens LinkSkillModal and displays selectable unlinked skills with role selection', () => {
    vi.spyOn(skillHooks, 'useSkills').mockReturnValue({
      data: [
        {
          skill: {
            id: 'skill-docker-1',
            user_id: 'user-alice',
            parent_skill_id: null,
            name: 'Docker & Containerization',
            slug: 'docker-containerization',
            description: null,
            category: 'DevOps',
            status: 'active',
            source: 'user',
            created_at: '',
            updated_at: '',
          },
          mastery: {
            state: 'proficient',
            score: 55,
            confidence: 'medium',
            evidence_count: 5,
            verified_evidence_count: 4,
            health: 'healthy',
            explanation: '',
            calculated_at: '',
            recent_activity_at: null,
          },
        },
      ] as SkillWithMasteryDto[],
      isLoading: false,
    } as unknown as ReturnType<typeof skillHooks.useSkills>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <LinkSkillModal
          isOpen={true}
          onClose={vi.fn()}
          projectId="proj-123"
          existingSkills={mockProjectDetail.skills}
        />
      </Wrapper>
    );

    expect(screen.getByText('Link Skill to Project')).toBeInTheDocument();
    expect(screen.getByText('Skill Role')).toBeInTheDocument();
    expect(screen.getByText(/Docker & Containerization/)).toBeInTheDocument();
  });

  // 11. Dark mode rendering
  it('renders Project Detail cleanly within dark mode container', () => {
    vi.spyOn(projectHooks, 'useProject').mockReturnValue({
      data: mockProjectDetail,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof projectHooks.useProject>);

    const Wrapper = createWrapper();
    const { container } = render(
      <div className="dark">
        <Wrapper>
          <ProjectDetailPage />
        </Wrapper>
      </div>
    );

    expect(container.querySelector('.dark')).toBeInTheDocument();
    expect(screen.getByText('Avenza Core Engine')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  // 12. Loading state
  it('renders skeleton loading state while project data is fetching', () => {
    vi.spyOn(projectHooks, 'useProject').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof projectHooks.useProject>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectDetailPage />
      </Wrapper>
    );

    expect(screen.getByTestId('project-detail-loading')).toBeInTheDocument();
  });

  // 13. Error state
  it('renders ErrorState with retry CTA when fetching project fails', () => {
    const mockRefetch = vi.fn();
    vi.spyOn(projectHooks, 'useProject').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load project details'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof projectHooks.useProject>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectDetailPage />
      </Wrapper>
    );

    expect(screen.getByTestId('project-detail-error')).toBeInTheDocument();
    expect(screen.getByText('Project Not Found')).toBeInTheDocument();
    expect(screen.getByText('Failed to load project details')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });
});
