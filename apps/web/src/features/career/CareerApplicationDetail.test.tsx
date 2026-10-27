/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CareerApplicationDetailPage } from './pages/CareerApplicationDetailPage';
import * as careerHooks from './hooks/useCareer';
import type {
  CareerApplicationDetailDto,
  CareerApplicationPreparationDto,
} from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockApplicationDetail: CareerApplicationDetailDto = {
  id: 'app-100',
  user_id: 'user-1',
  opportunity_id: 'opp-100',
  stage: 'interview',
  applied_at: '2026-10-01T00:00:00Z',
  deadline: '2026-11-15T00:00:00Z',
  resume_file_url: 'https://storage.avenza.dev/resume.pdf',
  cover_letter_url: null,
  notes: 'Focused on distributed storage and raft consensus discussion.',
  rejection_reason: null,
  opportunity: {
    id: 'opp-100',
    user_id: 'user-1',
    target_id: 'target-1',
    company_name: 'Figma',
    role_title: 'Senior Infrastructure Engineer',
    employment_type: 'full_time',
    location_type: 'hybrid',
    location: 'San Francisco, CA',
    source: 'company_website',
    job_url: 'https://figma.com/careers/infra',
    salary_min: 210000,
    salary_max: 260000,
    salary_currency: 'USD',
    deadline: '2026-11-15T00:00:00Z',
    description: 'Lead engineering for collaborative systems.',
    status: 'active',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-05T00:00:00Z',
  history: [
    {
      id: 'hist-1',
      user_id: 'user-1',
      application_id: 'app-100',
      from_stage: 'saved',
      to_stage: 'applied',
      changed_at: '2026-10-01T12:00:00Z',
      notes: 'Applied through company portal',
    },
    {
      id: 'hist-2',
      user_id: 'user-1',
      application_id: 'app-100',
      from_stage: 'applied',
      to_stage: 'screening',
      changed_at: '2026-10-03T10:00:00Z',
      notes: 'Recruiter reached out',
    },
    {
      id: 'hist-3',
      user_id: 'user-1',
      application_id: 'app-100',
      from_stage: 'screening',
      to_stage: 'interview',
      changed_at: '2026-10-05T15:30:00Z',
      notes: 'Passed recruiter screen, scheduled system design',
    },
  ],
  projects: [],
  interviews: [],
};

const mockPreparationData: CareerApplicationPreparationDto = {
  application_id: 'app-100',
  company_name: 'Figma',
  role_title: 'Senior Infrastructure Engineer',
  current_stage: 'interview',
  target_id: 'target-1',
  opportunity_id: 'opp-100',
  skills: {
    required: [
      {
        skill_id: 'skill-1',
        skill_name: 'Distributed Systems',
        skill_slug: 'distributed-systems',
        skill_category: 'Backend',
        importance: 'required',
        source: 'both',
        current_level: 'proficient',
        mastery_score: 85,
        confidence_score: 90,
        status: 'mastered',
        is_verified: true,
        is_acquired: true,
      },
      {
        skill_id: 'skill-2',
        skill_name: 'Kubernetes Orchestration',
        skill_slug: 'kubernetes',
        skill_category: 'DevOps',
        importance: 'required',
        source: 'opportunity',
        current_level: null,
        mastery_score: null,
        confidence_score: null,
        status: null,
        is_verified: false,
        is_acquired: false,
      },
    ],
    preferred: [
      {
        skill_id: 'skill-3',
        skill_name: 'Rust Systems Programming',
        skill_slug: 'rust',
        skill_category: 'Languages',
        importance: 'preferred',
        source: 'target',
        current_level: 'competent',
        mastery_score: 72,
        confidence_score: 80,
        status: 'practicing',
        is_verified: true,
        is_acquired: true,
      },
    ],
    bonus: [],
    summary: {
      total_skills: 3,
      acquired_skills: 2,
      missing_skills: 1,
      required_total: 2,
      required_acquired: 1,
    },
  },
  projects: {
    featured: [
      {
        project_id: 'proj-1',
        title: 'Distributed Consensus Engine',
        slug: 'consensus-engine',
        status: 'in_progress',
        is_featured: true,
        talking_points: 'Implemented Raft snapshotting and dynamic membership changes.',
        evidence: [],
      },
    ],
    supporting: [],
  },
  tasks: {
    open: [
      {
        id: 'task-1',
        title: 'Review Figma Multiplayer Architecture blog',
        status: 'todo',
        priority: 'high',
        due_at: '2026-10-20T00:00:00Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        is_blocked: false,
      },
    ],
    completed: [
      {
        id: 'task-2',
        title: 'Review Raft Consensus Whitepaper',
        status: 'completed',
        priority: 'medium',
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: '2026-10-04T00:00:00Z',
        is_blocked: false,
      },
    ],
    open_count: 1,
    completed_count: 1,
  },
  interviews: [
    {
      id: 'int-1',
      user_id: 'user-1',
      application_id: 'app-100',
      round_number: 1,
      round_type: 'recruiter_screen',
      scheduled_at: '2026-10-04T10:00:00Z',
      duration_minutes: 30,
      meeting_link: 'https://meet.google.com/abc-xyz',
      status: 'completed',
      result: 'passed',
      interviewer_names: ['Sarah Connor (Technical Recruiter)'],
      notes: 'Positive conversation on culture fit and team scope',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-04T11:00:00Z',
    },
    {
      id: 'int-2',
      user_id: 'user-1',
      application_id: 'app-100',
      round_number: 2,
      round_type: 'system_design',
      scheduled_at: '2026-10-18T14:00:00Z',
      duration_minutes: 60,
      meeting_link: 'https://meet.google.com/figma-design',
      status: 'scheduled',
      result: 'pending',
      interviewer_names: ['Alex Rivera (Principal Engineer)'],
      notes: 'Prepare multiplayer state sync diagrams',
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    },
  ],
};

function createWrapper(initialEntries = ['/career/applications/app-100']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/career/applications/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CareerApplicationDetailPage & Preparation Workspace (Phase 16E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(careerHooks, 'useCareerApplication').mockReturnValue({
      data: mockApplicationDetail,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(careerHooks, 'useCareerApplicationPreparation').mockReturnValue({
      data: mockPreparationData,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(careerHooks, 'useCareerApplicationTasks').mockReturnValue({
      data: [...mockPreparationData.tasks.open, ...mockPreparationData.tasks.completed],
      isLoading: false,
    } as any);

    vi.spyOn(careerHooks, 'useCareerApplicationHistory').mockReturnValue({
      data: mockApplicationDetail.history,
      isLoading: false,
    } as any);
  });

  it('renders application details and preparation readiness summary', () => {
    const Wrapper = createWrapper();
    render(<CareerApplicationDetailPage />, { wrapper: Wrapper });

    // Header info
    expect(screen.getByText('Senior Infrastructure Engineer')).toBeInTheDocument();
    expect(screen.getByText('Figma')).toBeInTheDocument();
    expect(screen.getByText('interview')).toBeInTheDocument();
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
    expect(screen.getByText('View Job Posting ↗')).toBeInTheDocument();

    // Summary cards: 1 / 2 required skills (50%)
    expect(screen.getAllByText('50%').length).toBe(2);
    expect(screen.getAllByText(/1 \/ 2/).length).toBe(2);
    expect(screen.getAllByText(/Required Skills/).length).toBeGreaterThanOrEqual(1);

    // Featured projects card
    expect(screen.getByText('1 Total')).toBeInTheDocument();

    // Tasks summary card: 1 / 2 completed
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  it('renders skills readiness tab and lists required and preferred skills', () => {
    const Wrapper = createWrapper();
    render(<CareerApplicationDetailPage />, { wrapper: Wrapper });

    expect(screen.getByText('Distributed Systems')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes Orchestration')).toBeInTheDocument();
    expect(screen.getByText('Rust Systems Programming')).toBeInTheDocument();

    // Status badges
    expect(screen.getAllByText('Acquired').length).toBe(2);
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  it('navigates to Talking Points & Projects tab and displays featured projects with talking points', () => {
    const Wrapper = createWrapper();
    render(<CareerApplicationDetailPage />, { wrapper: Wrapper });

    const projectsTab = screen.getByRole('button', { name: 'Talking Points & Projects' });
    fireEvent.click(projectsTab);

    expect(screen.getByText('Distributed Consensus Engine')).toBeInTheDocument();
    expect(screen.getAllByText('Featured').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText('Implemented Raft snapshotting and dynamic membership changes.')
    ).toBeInTheDocument();
    expect(screen.getByText('+ Attach Project')).toBeInTheDocument();
  });

  it('navigates to Preparation Tasks tab and displays application-linked tasks', () => {
    const Wrapper = createWrapper();
    render(<CareerApplicationDetailPage />, { wrapper: Wrapper });

    const tasksTab = screen.getByRole('button', { name: 'Preparation Tasks' });
    fireEvent.click(tasksTab);

    expect(screen.getByText('Review Figma Multiplayer Architecture blog')).toBeInTheDocument();
    expect(screen.getByText('Review Raft Consensus Whitepaper')).toBeInTheDocument();
    expect(screen.getByText('+ Add Preparation Task')).toBeInTheDocument();
  });

  it('navigates to Interview Schedule tab and displays scheduled rounds', () => {
    const Wrapper = createWrapper();
    render(<CareerApplicationDetailPage />, { wrapper: Wrapper });

    const interviewsTab = screen.getByRole('button', { name: 'Interview Rounds' });
    fireEvent.click(interviewsTab);

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('recruiter screen')).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.getByText('system design')).toBeInTheDocument();
    expect(screen.getByText('+ Schedule Interview Round')).toBeInTheDocument();
  });

  it('navigates to Stage Audit History tab and renders chronological timeline', () => {
    const Wrapper = createWrapper();
    render(<CareerApplicationDetailPage />, { wrapper: Wrapper });

    const historyTab = screen.getByRole('button', { name: 'Stage Audit History' });
    fireEvent.click(historyTab);

    expect(screen.getByText('Stage Transition Audit Log')).toBeInTheDocument();
    expect(screen.getByText('Applied through company portal')).toBeInTheDocument();
    expect(screen.getByText('Recruiter reached out')).toBeInTheDocument();
    expect(screen.getByText('Passed recruiter screen, scheduled system design')).toBeInTheDocument();
  });
});
