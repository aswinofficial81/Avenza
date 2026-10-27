import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OverviewPage } from './OverviewPage';
import * as todayHooks from '../features/today/useToday';
import * as intelligenceHooks from '../features/intelligence/useNextAction';
import * as goalsHooks from '../features/goals/useGoals';
import * as dsaHooks from '../features/dsa/hooks/use-dsa-overview';
import * as academicsHooks from '../features/academics/useAcademics';
import * as careerHooks from '../features/career/hooks/useCareer';
import * as projectsHooks from '../features/projects/hooks/useProjects';
import * as focusHooks from '../features/focus/useFocusSession';
import type {
  TodayResponse,
  NextActionResponseData,
  PaginatedList,
  GoalDto,
  AcademicsOverviewDto,
  CareerInterviewDto,
  FocusSessionDto,
} from '@avenza/shared';

// Mock Clerk user
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: {
      id: 'user-executive-1',
      firstName: 'Jane',
      fullName: 'Jane Doe',
      primaryEmailAddress: { emailAddress: 'jane@example.com' },
    },
  }),
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockTodayData: TodayResponse = {
  date: '2026-10-17',
  timezone: 'America/New_York',
  summary: {
    completedTaskCount: 2,
    meaningfulMinutes: 75,
    focusMinutes: 50,
    fallbackTaskActualMinutes: 25,
    estimatedMinutesWithoutActual: 30,
    dailyMinimum: 60,
    dailyTarget: 120,
    maxDailyStudy: 300,
    minimumProgress: 100,
    targetProgress: 63,
  },
  next: {
    id: 'task-next-1',
    user_id: 'user-executive-1',
    title: 'Implement Raft Consensus Algorithm',
    description: 'Core consensus protocol implementation',
    task_type: 'project',
    status: 'in_progress',
    priority: 'high',
    goal_id: 'goal-1',
    milestone_id: 'ms-1',
    goal_title: 'Distributed Systems Mastery',
    milestone_title: 'Consensus Engines',
    estimated_minutes: 90,
    actual_minutes: null,
    due_at: '2026-10-17T20:00:00Z',
    scheduled_start: '2026-10-17T10:00:00Z',
    scheduled_end: '2026-10-17T11:30:00Z',
    completed_at: null,
    notes: null,
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
    is_blocked: false,
    blocking_task_count: 0,
    blocked_by: [],
    metrics: {
      is_blocked: false,
      blocking_task_count: 0,
      blocked_by: [],
    },
  },
  overdue: [],
  dueToday: [
    {
      id: 'task-due-1',
      user_id: 'user-executive-1',
      title: 'Review Operating Systems Lecture Notes',
      description: 'Prepare for midterm review',
      task_type: 'revision',
      status: 'planned',
      priority: 'medium',
      goal_id: null,
      milestone_id: null,
      goal_title: null,
      milestone_title: null,
      estimated_minutes: 45,
      actual_minutes: null,
      due_at: '2026-10-17T18:00:00Z',
      scheduled_start: null,
      scheduled_end: null,
      completed_at: null,
      notes: null,
      created_at: '2026-10-12T00:00:00Z',
      updated_at: '2026-10-12T00:00:00Z',
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
  scheduledToday: [],
  upcoming: [],
  completedToday: [
    {
      id: 'task-completed-1',
      user_id: 'user-executive-1',
      title: 'Solve LeetCode 33: Search in Rotated Sorted Array',
      description: 'Binary search variant',
      task_type: 'dsa',
      status: 'completed',
      priority: 'high',
      goal_id: null,
      milestone_id: null,
      goal_title: null,
      milestone_title: null,
      estimated_minutes: 30,
      actual_minutes: 25,
      due_at: null,
      scheduled_start: null,
      scheduled_end: null,
      completed_at: '2026-10-17T09:30:00Z',
      notes: null,
      created_at: '2026-10-15T00:00:00Z',
      updated_at: '2026-10-17T09:30:00Z',
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
};

const mockNextActionData: NextActionResponseData = {
  action: {
    type: 'focus_task',
    taskId: 'task-next-1',
    title: 'Implement Raft Consensus Algorithm',
    score: 95,
    goalTitle: 'Distributed Systems Mastery',
    milestoneTitle: 'Consensus Engines',
    priority: 'high',
    dueAt: '2026-10-17T20:00:00Z',
    estimatedMinutes: 90,
  },
  confidence: 'high',
  reason: {
    code: 'high_priority',
    label: 'High Priority',
    explanation: 'Scheduled for today with high priority and active progress',
  },
  generatedAt: '2026-10-17T10:00:00Z',
};

const mockGoalsResponse: PaginatedList<GoalDto> = {
  data: [
    {
      id: 'goal-1',
      user_id: 'user-executive-1',
      title: 'Master Distributed Systems',
      description: 'Deep understanding of consensus, fault tolerance, and replication',
      goal_type: 'learning',
      status: 'active',
      priority: 'high',
      start_date: '2026-09-01',
      target_date: '2026-12-31',
      completed_at: null,
      desired_outcome: 'Build production-ready Raft and distributed KV store',
      completion_criteria: 'All milestones completed',
      notes: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      metrics: {
        milestoneCount: 4,
        completedMilestoneCount: 2,
        progressPercentage: 50,
        healthStatus: 'on_track',
      },
    },
  ],
  pagination: {
    page: 1,
    pageSize: 3,
    total: 1,
    totalPages: 1,
  },
};

const mockDsaOverview = {
  total_problems: 42,
  solved_problems: 36,
  attempted_problems: 40,
  revision_due_count: 5,
  weak_areas: [
    {
      topic_id: 'topic-dp',
      topic_name: 'Dynamic Programming',
      problem_count: 8,
      failure_count: 3,
      reason: 'Low first-attempt pass rate',
    },
  ],
  recommended_problem: {
    id: 'prob-coin-change',
    title: 'Coin Change II',
    reason: 'Spaced repetition due for knapsack pattern',
  },
};

const mockAcademicsOverview: AcademicsOverviewDto = {
  active_term: {
    id: 'term-1',
    user_id: 'user-executive-1',
    academic_year_id: null,
    name: 'Fall 2026',
    code: 'F26',
    start_date: '2026-08-20',
    end_date: '2026-12-20',
    status: 'active',
    is_current: true,
    notes: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    subject_count: 3,
  },
  subjects: [],
  upcoming_exams: [
    {
      id: 'exam-1',
      user_id: 'user-executive-1',
      term_id: 'term-1',
      subject_id: 'subj-os',
      title: 'Operating Systems Midterm',
      exam_type: 'midterm',
      exam_date: '2026-10-25',
      duration_minutes: 120,
      location: 'Hall B',
      weight_percent: 25,
      status: 'planned',
      notes: null,
      created_at: '2026-08-20T00:00:00Z',
      updated_at: '2026-08-20T00:00:00Z',
      subject_name: 'Operating Systems',
    },
  ],
  upcoming_assessments: [],
  overall_coverage: {
    total_topics: 20,
    covered_topics: 12,
    in_progress_topics: 4,
    needs_review_topics: 2,
    not_started_topics: 2,
    coverage_percentage: 60,
  },
};

const mockCareerInterviews: { data: CareerInterviewDto[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } } = {
  data: [
    {
      id: 'interview-1',
      user_id: 'user-executive-1',
      application_id: 'app-stripe',
      round_number: 2,
      round_type: 'technical_dsa',
      scheduled_at: '2026-10-28T14:00:00Z',
      duration_minutes: 60,
      meeting_link: 'https://meet.google.com/xyz',
      status: 'scheduled',
      result: 'pending',
      interviewer_names: ['Staff Engineer'],
      notes: null,
      created_at: '2026-10-15T00:00:00Z',
      updated_at: '2026-10-15T00:00:00Z',
    },
  ],
  pagination: {
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  },
};

const mockProjectsResponse = {
  data: [
    {
      id: 'proj-1',
      user_id: 'user-executive-1',
      title: 'High-Performance Raft KV Store',
      slug: 'raft-kv-store',
      description: 'Distributed consensus key-value store in Go',
      project_type: 'technical',
      status: 'in_progress' as const,
      priority: 'high' as const,
      repository_url: 'https://github.com/example/raft-kv',
      live_url: null,
      start_date: '2026-09-10',
      target_date: '2026-11-30',
      completed_at: null,
      readme_summary: null,
      architecture_notes: null,
      created_at: '2026-09-10T00:00:00Z',
      updated_at: '2026-09-10T00:00:00Z',
      metrics: {
        milestoneCount: 3,
        completedMilestoneCount: 1,
        taskCount: 6,
        completedTaskCount: 3,
        progressPercentage: 50,
        healthStatus: 'on_track' as const,
      },
    },
  ],
  pagination: {
    total: 1,
    page: 1,
    pageSize: 3,
    totalPages: 1,
  },
};

const renderOverviewPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OverviewPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('OverviewPage — Executive Dashboard (Phase 18B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default healthy mock responses
    vi.spyOn(todayHooks, 'useToday').mockReturnValue({
      data: mockTodayData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof todayHooks.useToday>);

    vi.spyOn(intelligenceHooks, 'useNextAction').mockReturnValue({
      data: mockNextActionData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof intelligenceHooks.useNextAction>);

    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: mockGoalsResponse,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    vi.spyOn(dsaHooks, 'useDsaOverview').mockReturnValue({
      data: mockDsaOverview,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof dsaHooks.useDsaOverview>);

    vi.spyOn(academicsHooks, 'useAcademicsOverview').mockReturnValue({
      data: mockAcademicsOverview,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useAcademicsOverview>);

    vi.spyOn(careerHooks, 'useCareerInterviews').mockReturnValue({
      data: mockCareerInterviews,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof careerHooks.useCareerInterviews>);

    vi.spyOn(projectsHooks, 'useProjects').mockReturnValue({
      data: mockProjectsResponse,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof projectsHooks.useProjects>);

    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);
  });

  it('1. no longer displays the hardcoded Phase 4 badge or debug panel', () => {
    renderOverviewPage();

    expect(screen.queryByText(/Phase 4 Active/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Verified Identity Session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fastify API & Supabase Profile Resolution/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phase 4 Foundation/i)).not.toBeInTheDocument();

    // Renders real executive header
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/Welcome back, Jane/i)).toBeInTheDocument();
  });

  it('2. renders the executive dashboard from valid domain responses', () => {
    renderOverviewPage();

    // Headers of all 6 widgets
    expect(screen.getByText("Today's Execution")).toBeInTheDocument();
    expect(screen.getByText('Active Goals')).toBeInTheDocument();
    expect(screen.getByText('DSA Progress')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Deadlines')).toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
  });

  it("3. displays real Today execution statistics and Next Best Action", () => {
    renderOverviewPage();

    // Today metrics
    expect(screen.getByText('75m')).toBeInTheDocument(); // Meaningful minutes
    expect(screen.getByText('of 120m target')).toBeInTheDocument();

    // Next best action title
    expect(screen.getAllByText('Implement Raft Consensus Algorithm').length).toBeGreaterThan(0);
  });

  it('4. renders active goals with accurate progress and milestone counts', () => {
    renderOverviewPage();

    expect(screen.getByText('Master Distributed Systems')).toBeInTheDocument();
    expect(screen.getByText('2/4 milestones')).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
  });

  it('5. displays real DSA statistics and recommended problem', () => {
    renderOverviewPage();

    expect(screen.getByText('36')).toBeInTheDocument(); // Solved
    expect(screen.getByText('of 42 problems')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Revisions due
    expect(screen.getByText('Coin Change II')).toBeInTheDocument();
  });

  it('6. displays legitimate empty state when DSA has no records', () => {
    vi.spyOn(dsaHooks, 'useDsaOverview').mockReturnValue({
      data: {
        total_problems: 0,
        solved_problems: 0,
        attempted_problems: 0,
        revision_due_count: 0,
        weak_areas: [],
        recommended_problem: null,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof dsaHooks.useDsaOverview>);

    renderOverviewPage();

    expect(screen.getByText('No DSA problems tracked')).toBeInTheDocument();
    expect(screen.getByText('Explore DSA')).toBeInTheDocument();
  });

  it('7. displays legitimate empty states for goals and projects when none exist', () => {
    vi.spyOn(goalsHooks, 'useGoals').mockReturnValue({
      data: { data: [], pagination: { total: 0, page: 1, pageSize: 3, totalPages: 0 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof goalsHooks.useGoals>);

    vi.spyOn(projectsHooks, 'useProjects').mockReturnValue({
      data: { data: [], pagination: { total: 0, page: 1, pageSize: 3, totalPages: 0 } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof projectsHooks.useProjects>);

    renderOverviewPage();

    expect(screen.getByText('No active goals')).toBeInTheDocument();
    expect(screen.getByText('Set a Goal')).toBeInTheDocument();
    expect(screen.getByText('No active projects')).toBeInTheDocument();
    expect(screen.getByText('View Projects')).toBeInTheDocument();
  });

  it('8. renders upcoming academic exams and career interviews', () => {
    renderOverviewPage();

    expect(screen.getByText('Operating Systems Midterm')).toBeInTheDocument();
    expect(screen.getByText('Round 2: technical dsa')).toBeInTheDocument();
  });

  it('9. tolerates partial failure of an optional widget without blanking the dashboard', () => {
    const dsaRefetch = vi.fn();
    vi.spyOn(dsaHooks, 'useDsaOverview').mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Network error on DSA service'),
      refetch: dsaRefetch,
    } as unknown as ReturnType<typeof dsaHooks.useDsaOverview>);

    renderOverviewPage();

    // DSA shows error with retry
    expect(screen.getByText('Unable to load DSA overview')).toBeInTheDocument();
    expect(screen.getByText('Network error on DSA service')).toBeInTheDocument();

    // Rest of dashboard remains fully operational
    expect(screen.getByText("Today's Execution")).toBeInTheDocument();
    expect(screen.getByText('Active Goals')).toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();

    // Clicking retry calls refetch
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(dsaRefetch).toHaveBeenCalled();
  });

  it('10. renders active focus banner when a session is active and omits it when none', () => {
    const activeFocusSession: FocusSessionDto = {
      id: 'focus-active-1',
      user_id: 'user-executive-1',
      task_id: 'task-next-1',
      session_type: 'focus',
      status: 'active',
      started_at: '2026-10-17T10:00:00Z',
      ended_at: null,
      planned_minutes: 45,
      actual_minutes: null,
      notes: null,
      created_at: '2026-10-17T10:00:00Z',
      updated_at: '2026-10-17T10:00:00Z',
    };

    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: activeFocusSession,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    renderOverviewPage();

    expect(screen.getByRole('region', { name: 'Active focus session' })).toBeInTheDocument();
    expect(screen.getByText(/Focus Session in Progress \(45m target\)/i)).toBeInTheDocument();
    expect(screen.getByText('Resume Focus')).toBeInTheDocument();
  });

  it('11. primary navigation buttons link to real routes', () => {
    renderOverviewPage();

    const openTodayBtn = screen.getByRole('button', { name: /Open Today/i });
    expect(openTodayBtn.closest('a')).toHaveAttribute('href', '/today');

    const plannerBtn = screen.getByRole('button', { name: /Planner/i });
    expect(plannerBtn.closest('a')).toHaveAttribute('href', '/planner');
  });
});
