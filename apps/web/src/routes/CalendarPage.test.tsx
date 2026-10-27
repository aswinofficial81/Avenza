import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarPage } from './CalendarPage';
import * as integrationsHooks from '../features/integrations/hooks/useIntegrations';
import * as tasksHooks from '../features/tasks/useTasks';
import * as academicsHooks from '../features/academics/useAcademics';
import * as careerHooks from '../features/career/hooks/useCareer';
import type {
  ExternalCalendarEventDto,
  IntegrationStatusResponseDto,
  TaskDto,
  ExamDto,
  AssessmentDto,
  CareerInterviewDto,
  PaginatedList,
} from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: {
      id: 'user-cal-1',
      firstName: 'Aswin',
      fullName: 'Aswin Babu',
      primaryEmailAddress: { emailAddress: 'aswin@example.com' },
    },
  }),
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockGCalConnectedStatus = {
  connected: true,
  connection: {
    id: 'conn-gcal-1',
    provider: 'google_calendar',
    external_username: 'Aswin Babu',
    external_email: 'aswin@example.com',
    status: 'CONNECTED',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-17T12:00:00Z',
  },
} as unknown as IntegrationStatusResponseDto;

const mockGCalDisconnectedStatus = {
  connected: false,
  connection: null,
} as unknown as IntegrationStatusResponseDto;

const mockGCalEvents = [
  {
    id: 'gcal-evt-1',
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
    connection_id: 'conn-gcal-1',
    calendar_id: 'primary',
    external_event_id: 'ext-1',
    title: 'Distributed Systems Architecture Review',
    start_time: '2026-10-17T14:00:00Z',
    end_time: '2026-10-17T15:30:00Z',
    is_all_day: false,
    is_busy: true,
    html_link: 'https://calendar.google.com/event?eid=123',
    status: 'confirmed' as const,
  },
  {
    id: 'gcal-evt-2',
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
    connection_id: 'conn-gcal-1',
    calendar_id: 'primary',
    external_event_id: 'ext-2',
    title: 'Company All-Hands Meeting',
    start_time: '2026-10-20T17:00:00Z',
    end_time: '2026-10-20T18:00:00Z',
    is_all_day: false,
    is_busy: false,
    html_link: 'https://calendar.google.com/event?eid=456',
    status: 'confirmed' as const,
  },
] as unknown as ExternalCalendarEventDto[];

const mockTasksData = {
  data: [
    {
      id: 'task-1',
      user_id: 'user-cal-1',
      title: 'Complete Distributed Lock Implementation',
      description: 'Implement Redis redlock pattern',
      task_type: 'project',
      status: 'in_progress',
      priority: 'high',
      goal_id: 'goal-1',
      milestone_id: null,
      goal_title: 'System Design Mastery',
      milestone_title: null,
      estimated_minutes: 120,
      actual_minutes: null,
      due_at: '2026-10-17T20:00:00Z',
      scheduled_start: '2026-10-17T10:00:00Z',
      scheduled_end: '2026-10-17T12:00:00Z',
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
        transitive_blocking_task_count: 0,
      },
    },
    {
      id: 'task-2',
      user_id: 'user-cal-1',
      title: 'Submit Operating Systems Assignment',
      description: 'Memory paging virtual memory simulation',
      task_type: 'assignment',
      status: 'planned',
      priority: 'critical',
      goal_id: null,
      milestone_id: null,
      goal_title: null,
      milestone_title: null,
      estimated_minutes: 60,
      actual_minutes: null,
      due_at: '2026-10-18T23:59:00Z',
      scheduled_start: null,
      scheduled_end: null,
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
        transitive_blocking_task_count: 0,
      },
    },
  ],
  meta: {
    total: 2,
    page: 1,
    pageSize: 50,
    totalPages: 1,
  },
} as unknown as PaginatedList<TaskDto>;

const mockExamsData = [
  {
    id: 'exam-1',
    user_id: 'user-cal-1',
    subject_id: 'subj-1',
    subject_name: 'Advanced Computer Networks',
    title: 'Midterm Examination',
    exam_date: '2026-10-22',
    duration_minutes: 120,
    weight_percent: 30,
    status: 'planned',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
] as unknown as ExamDto[];

const mockAssessmentsData = [
  {
    id: 'asmt-1',
    user_id: 'user-cal-1',
    subject_id: 'subj-2',
    subject_name: 'Database Engineering',
    title: 'B+ Tree Indexing Benchmark',
    due_at: '2026-10-25T23:59:00Z',
    weight_percent: 20,
    status: 'planned',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
] as unknown as AssessmentDto[];

const mockCareerInterviewsData = {
  data: [
    {
      id: 'interview-1',
      user_id: 'user-cal-1',
      application_id: 'app-1',
      round_number: 2,
      round_type: 'technical_dsa',
      scheduled_at: '2026-10-17T16:00:00Z',
      duration_minutes: 60,
      status: 'scheduled',
      meeting_link: 'https://meet.google.com/xyz-abc-def',
      notes: 'Focus on graphs and dynamic programming',
      created_at: '2026-10-12T00:00:00Z',
      updated_at: '2026-10-12T00:00:00Z',
    },
  ],
  meta: {
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  },
} as unknown as PaginatedList<CareerInterviewDto>;

describe('CalendarPage (Phase 18C Unified Calendar)', () => {
  let queryClient: QueryClient;
  const mockSyncMutateAsync = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Default mocks: Connected Google Calendar + full datasets
    vi.spyOn(integrationsHooks, 'useIntegrationStatus').mockReturnValue({
      data: mockGCalConnectedStatus,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof integrationsHooks.useIntegrationStatus>);

    vi.spyOn(integrationsHooks, 'useIntegrationCalendarEvents').mockReturnValue({
      data: mockGCalEvents,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof integrationsHooks.useIntegrationCalendarEvents>);

    vi.spyOn(integrationsHooks, 'useSyncIntegration').mockReturnValue({
      mutateAsync: mockSyncMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof integrationsHooks.useSyncIntegration>);

    vi.spyOn(tasksHooks, 'useTasks').mockReturnValue({
      data: mockTasksData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof tasksHooks.useTasks>);

    vi.spyOn(academicsHooks, 'useExams').mockReturnValue({
      data: mockExamsData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useExams>);

    vi.spyOn(academicsHooks, 'useAssessments').mockReturnValue({
      data: mockAssessmentsData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useAssessments>);

    vi.spyOn(careerHooks, 'useCareerInterviews').mockReturnValue({
      data: mockCareerInterviewsData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof careerHooks.useCareerInterviews>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CalendarPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders the CalendarPage container and header instead of a placeholder', () => {
    renderComponent();

    // The dedicated calendar page container must render
    expect(screen.getByTestId('calendar-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /calendar/i })).toBeInTheDocument();
    expect(screen.getByText(/unified schedule/i)).toBeInTheDocument();

    // Verify it is NOT a placeholder page
    expect(screen.queryByText(/Calendar Phase/i)).not.toBeInTheDocument();
  });

  it('renders the Google Calendar connection banner when connected with read-only badge and sync trigger', () => {
    renderComponent();

    expect(screen.getByText('Google Calendar Active')).toBeInTheDocument();
    expect(screen.getByText('(aswin@example.com)')).toBeInTheDocument();
    expect(screen.getByText('Read-Only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
  });

  it('triggers Google Calendar sync when the Sync Now button is clicked', async () => {
    renderComponent();

    const syncBtn = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncBtn);

    expect(mockSyncMutateAsync).toHaveBeenCalledWith('google_calendar');
  });

  it('renders the disconnected banner with guidance when Google Calendar is not connected', () => {
    vi.spyOn(integrationsHooks, 'useIntegrationStatus').mockReturnValue({
      data: mockGCalDisconnectedStatus,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof integrationsHooks.useIntegrationStatus>);

    vi.spyOn(integrationsHooks, 'useIntegrationCalendarEvents').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof integrationsHooks.useIntegrationCalendarEvents>);

    renderComponent();

    expect(screen.getByText('Connect Google Calendar')).toBeInTheDocument();
    expect(screen.getByText(/connect in settings/i)).toBeInTheDocument();

    // Avenza tasks should still be present even without external calendar
    expect(screen.getByTestId('calendar-page')).toBeInTheDocument();
  });

  it('renders the calendar legend with all four event categories', () => {
    renderComponent();

    const legends = screen.getAllByRole('region', { name: /calendar event types legend/i });
    expect(legends.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Google Calendar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tasks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Academics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Career').length).toBeGreaterThan(0);
  });

  it('supports navigation between Month, Week, and Agenda views', () => {
    renderComponent();

    // Default view is month
    expect(screen.getByRole('button', { name: 'Month' })).toHaveClass('bg-surface');

    // Switch to Week view
    const weekBtn = screen.getByRole('button', { name: 'Week' });
    fireEvent.click(weekBtn);
    expect(weekBtn).toHaveClass('bg-surface');

    // Switch to Agenda view
    const agendaBtn = screen.getByRole('button', { name: 'Agenda' });
    fireEvent.click(agendaBtn);
    expect(agendaBtn).toHaveClass('bg-surface');
    expect(screen.getByTestId('calendar-agenda-view')).toBeInTheDocument();
  });

  it('aggregates Google Calendar, tasks, exams, and interviews in the Agenda view', () => {
    renderComponent();

    // Switch to Agenda view
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));

    const agendaView = screen.getByTestId('calendar-agenda-view');

    // External Google Calendar event
    expect(agendaView).toHaveTextContent('Distributed Systems Architecture Review');

    // Avenza Scheduled Task & Task Deadline
    expect(agendaView).toHaveTextContent('Complete Distributed Lock Implementation');
    expect(agendaView).toHaveTextContent('Deadline: Complete Distributed Lock Implementation');

    // Academic Exam & Assessment
    expect(agendaView).toHaveTextContent('Exam: Midterm Examination');
    expect(agendaView).toHaveTextContent('Assessment: B+ Tree Indexing Benchmark');

    // Career Interview
    expect(agendaView).toHaveTextContent(/Round 2: technical dsa/i);
  });

  it('renders the selected day agenda with correct events and external links', () => {
    renderComponent();

    // Day agenda container should be rendered
    const dayAgenda = screen.getByTestId('calendar-day-agenda');
    expect(dayAgenda).toBeInTheDocument();

    // Verify external link icon exists for Google Calendar event
    const externalLinks = screen.getAllByRole('link', { name: /open external link/i });
    expect(externalLinks.length).toBeGreaterThan(0);
    expect(externalLinks[0]).toHaveAttribute('target', '_blank');
  });

  it('navigates previous, next, and returns to today using navigation buttons', () => {
    renderComponent();

    const prevBtn = screen.getByRole('button', { name: /previous period/i });
    const nextBtn = screen.getByRole('button', { name: /next period/i });
    const todayBtn = screen.getByRole('button', { name: /today/i });

    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
    expect(todayBtn).toBeInTheDocument();

    // Clicking Next period
    fireEvent.click(nextBtn);

    // Clicking Today resets
    fireEvent.click(todayBtn);
  });

  it('renders partial error notification when an event source fails without crashing the calendar', () => {
    vi.spyOn(integrationsHooks, 'useIntegrationCalendarEvents').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch external events'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof integrationsHooks.useIntegrationCalendarEvents>);

    renderComponent();

    // Page must still render
    expect(screen.getByTestId('calendar-page')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-partial-error')).toBeInTheDocument();
  });
});
