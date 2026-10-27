/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CareerPipelinePage } from './pages/CareerPipelinePage';
import { StageTransitionModal } from './components/StageTransitionModal';
import * as careerHooks from './hooks/useCareer';
import {
  CAREER_STAGE_TRANSITIONS,
  isTerminalStage,
  isValidStageTransition,
  type CareerApplicationDto,
  type CareerOpportunityDto,
} from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockOpportunities: CareerOpportunityDto[] = [
  {
    id: 'opp-1',
    user_id: 'user-1',
    target_id: 'target-1',
    company_name: 'Stripe',
    role_title: 'Staff Infrastructure Engineer',
    employment_type: 'full_time',
    location_type: 'remote',
    location: 'San Francisco, CA',
    source: 'company_website',
    job_url: 'https://stripe.com/jobs/1',
    salary_min: 220000,
    salary_max: 270000,
    salary_currency: 'USD',
    deadline: '2026-11-01T00:00:00Z',
    description: 'Lead next generation consensus storage.',
    status: 'active',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  {
    id: 'opp-2',
    user_id: 'user-1',
    target_id: 'target-1',
    company_name: 'Datadog',
    role_title: 'Senior Distributed Systems Engineer',
    employment_type: 'full_time',
    location_type: 'remote',
    location: 'New York, NY',
    source: 'linkedin',
    job_url: 'https://datadoghq.com/jobs/2',
    salary_min: 190000,
    salary_max: 240000,
    salary_currency: 'USD',
    deadline: null,
    description: 'High throughput metrics ingestion pipeline.',
    status: 'active',
    created_at: '2026-10-02T00:00:00Z',
    updated_at: '2026-10-05T00:00:00Z',
  },
  {
    id: 'opp-3',
    user_id: 'user-1',
    target_id: null,
    company_name: 'Anthropic',
    role_title: 'Systems Researcher',
    employment_type: 'full_time',
    location_type: 'onsite',
    location: 'San Francisco, CA',
    source: 'referral',
    job_url: 'https://anthropic.com/careers/3',
    salary_min: 300000,
    salary_max: 380000,
    salary_currency: 'USD',
    deadline: null,
    description: 'Scaling distributed training clusters.',
    status: 'active',
    created_at: '2026-09-18T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
  },
];

const mockApplications: CareerApplicationDto[] = [
  {
    id: 'app-1',
    user_id: 'user-1',
    opportunity_id: 'opp-1',
    stage: 'saved',
    applied_at: null,
    deadline: '2026-11-01T00:00:00Z',
    resume_file_url: null,
    cover_letter_url: null,
    notes: 'Saved for review',
    rejection_reason: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  {
    id: 'app-2',
    user_id: 'user-1',
    opportunity_id: 'opp-2',
    stage: 'applied',
    applied_at: '2026-10-05T00:00:00Z',
    deadline: null,
    resume_file_url: null,
    cover_letter_url: null,
    notes: null,
    rejection_reason: null,
    created_at: '2026-10-02T00:00:00Z',
    updated_at: '2026-10-05T00:00:00Z',
  },
  {
    id: 'app-3',
    user_id: 'user-1',
    opportunity_id: 'opp-3',
    stage: 'interview',
    applied_at: '2026-09-20T00:00:00Z',
    deadline: null,
    resume_file_url: null,
    cover_letter_url: null,
    notes: 'Round 2 scheduled',
    rejection_reason: null,
    created_at: '2026-09-18T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
  },
];

function createWrapper(initialEntries = ['/career']) {
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
          <Route path="/career" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CareerPipelinePage & Stage Machine (Phase 16E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(careerHooks, 'useCareerApplications').mockReturnValue({
      data: {
        data: mockApplications,
        pagination: { total: 3, page: 1, pageSize: 20, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(careerHooks, 'useCareerOpportunities').mockReturnValue({
      data: {
        data: mockOpportunities,
        pagination: { total: 3, page: 1, pageSize: 20, totalPages: 1 },
      },
      isLoading: false,
    } as any);

    vi.spyOn(careerHooks, 'useCareerTargets').mockReturnValue({
      data: { data: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 } },
      isLoading: false,
    } as any);
  });

  it('renders pipeline header, stats, and kanban columns', () => {
    const Wrapper = createWrapper();
    render(<CareerPipelinePage />, { wrapper: Wrapper });

    expect(screen.getByText('Career Pipeline & Workspace')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Kanban')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Career Targets')).toBeInTheDocument();

    // Verify company cards rendered in pipeline
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getByText('Datadog')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('filters applications by search query in Kanban view', () => {
    const Wrapper = createWrapper();
    render(<CareerPipelinePage />, { wrapper: Wrapper });

    const searchInput = screen.getByPlaceholderText('Filter by company or role...');
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Stripe' } });

    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.queryByText('Datadog')).not.toBeInTheDocument();
    expect(screen.queryByText('Anthropic')).not.toBeInTheDocument();
  });

  it('verifies strict transition matrix and terminal stage rules', () => {
    // 1. Saved permits applied, withdrawn, closed
    expect(isValidStageTransition('saved', 'applied')).toBe(true);
    expect(isValidStageTransition('saved', 'withdrawn')).toBe(true);
    expect(isValidStageTransition('saved', 'closed')).toBe(true);
    // Saved cannot jump to offer directly
    expect(isValidStageTransition('saved', 'offer')).toBe(false);
    expect(isValidStageTransition('saved', 'interview')).toBe(false);

    // 2. Applied permits screening, assessment, interview, offer, rejected, withdrawn, closed
    expect(isValidStageTransition('applied', 'screening')).toBe(true);
    expect(isValidStageTransition('applied', 'assessment')).toBe(true);
    expect(isValidStageTransition('applied', 'interview')).toBe(true);

    // 3. Terminal stages cannot transition to anything
    expect(isTerminalStage('accepted')).toBe(true);
    expect(isTerminalStage('declined')).toBe(true);
    expect(isTerminalStage('rejected')).toBe(true);
    expect(isTerminalStage('withdrawn')).toBe(true);
    expect(isTerminalStage('closed')).toBe(true);
    expect(CAREER_STAGE_TRANSITIONS['rejected']).toEqual([]);
    expect(isValidStageTransition('rejected', 'applied')).toBe(false);
  });

  it('handles StageTransitionModal permitted options and successful transition', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({ id: 'app-1', stage: 'applied' });
    vi.spyOn(careerHooks, 'useTransitionCareerApplicationStage').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    } as any);

    const onClose = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <StageTransitionModal
          isOpen={true}
          onClose={onClose}
          application={mockApplications[0]!}
          opportunity={mockOpportunities[0]}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Advance Application Stage')).toBeInTheDocument();
    expect(screen.getByText('Current Stage')).toBeInTheDocument();

    const stageSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(stageSelect).toBeInTheDocument();

    // From 'saved', permitted transitions are applied, withdrawn, closed
    const options = Array.from(stageSelect.options).map((o) => o.value);
    expect(options).toContain('applied');
    expect(options).toContain('withdrawn');
    expect(options).toContain('closed');
    expect(options).not.toContain('offer');

    // Change stage to 'applied' and submit
    fireEvent.change(stageSelect, { target: { value: 'applied' } });
    const submitBtn = screen.getByText('Confirm Transition');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        stage: 'applied',
        from_stage: 'saved',
        expected_stage: 'saved',
        notes: undefined,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles HTTP 409 conflict: refetches real server stage and shows conflict error without optimistic state', async () => {
    const conflictError = new Error('Application stage conflict: expected saved but found screening');
    (conflictError as any).statusCode = 409;

    const mockMutateAsync = vi.fn().mockRejectedValue(conflictError);
    vi.spyOn(careerHooks, 'useTransitionCareerApplicationStage').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    } as any);

    const onClose = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <StageTransitionModal
          isOpen={true}
          onClose={onClose}
          application={mockApplications[0]!}
          opportunity={mockOpportunities[0]}
        />
      </QueryClientProvider>
    );

    const stageSelect = screen.getByRole('combobox');
    fireEvent.change(stageSelect, { target: { value: 'applied' } });
    const submitBtn = screen.getByText('Confirm Transition');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
      // Should show conflict error message in the modal
      expect(screen.getByText('Stage Transition Notice')).toBeInTheDocument();
      expect(
        screen.getByText(/Conflict detected: The server persisted stage has changed/)
      ).toBeInTheDocument();
    });
  });
});
