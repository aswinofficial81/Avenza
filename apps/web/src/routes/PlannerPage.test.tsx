import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlannerPage } from './PlannerPage';
import { AppRoutes } from './index';
import * as plannerHooks from '../features/planner/usePlanner';
import type { ScheduleProposalResponseDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({
    user: {
      id: 'user-planner-1',
      firstName: 'Alice',
      fullName: 'Alice Planner',
      primaryEmailAddress: { emailAddress: 'alice@example.com' },
    },
  }),
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockProposal: ScheduleProposalResponseDto = {
  proposalId: '00000000-0000-0000-0000-000000000099',
  targetDate: '2026-10-18',
  timezone: 'America/New_York',
  studyWindow: {
    start: '09:00',
    end: '17:00',
  },
  dailyTargetMinutes: 120,
  maxDailyStudyMinutes: 240,
  totalProposedMinutes: 90,
  isExternalCalendarAvailable: false,
  warnings: [
    'Google Calendar is not connected. Schedule computed using Avenza commitments only.',
    'Task "Cache invalidation write-up" has no estimate; defaulted to provisional 30 minutes.',
  ],
  existingCommitments: [
    {
      id: 'commit-1',
      title: 'Distributed Systems Architecture Review',
      start: '2026-10-18T10:00:00.000Z',
      end: '2026-10-18T11:00:00.000Z',
      source: 'task_scheduled',
      isAllDay: false,
      isBusy: true,
    },
  ],
  proposedBlocks: [
    {
      taskId: '00000000-0000-0000-0000-000000000001',
      title: 'Implement Raft Heartbeat',
      scheduledStart: '2026-10-18T09:00:00.000Z',
      scheduledEnd: '2026-10-18T10:00:00.000Z',
      durationMinutes: 60,
      priority: 'high',
      taskType: 'project',
      score: 80,
      isDurationDefaulted: false,
      primaryReason: 'Urgent priority, due tomorrow',
      expectedUpdatedAt: '2026-10-17T12:00:00.000Z',
    },
    {
      taskId: '00000000-0000-0000-0000-000000000002',
      title: 'Cache invalidation write-up',
      scheduledStart: '2026-10-18T11:00:00.000Z',
      scheduledEnd: '2026-10-18T11:30:00.000Z',
      durationMinutes: 30,
      priority: 'medium',
      taskType: 'study',
      score: 65,
      isDurationDefaulted: true,
      primaryReason: 'Medium priority, ready to work',
      expectedUpdatedAt: '2026-10-17T12:00:00.000Z',
    },
  ],
  unscheduledTasks: [
    {
      taskId: '00000000-0000-0000-0000-000000000003',
      title: 'Deploy to Kubernetes Cluster',
      estimatedMinutes: 45,
      priority: 'high',
      reason: 'BLOCKED_BY_DEPENDENCY',
      reasonMessage: 'Prerequisites incomplete (1 prerequisite remaining)',
    },
    {
      taskId: '00000000-0000-0000-0000-000000000004',
      title: 'Read Consensus Paper',
      estimatedMinutes: 60,
      priority: 'low',
      reason: 'CAPACITY_REACHED',
      reasonMessage: 'Daily study target of 120 minutes reached',
    },
  ],
  generatedAt: '2026-10-17T12:00:00.000Z',
};

function renderWithClient(ui: React.ReactElement, initialRoute = '/planner') {
  window.history.pushState({}, 'Test', initialRoute);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('PlannerPage & /planner Route', () => {
  let mutateAsyncMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsyncMock = vi.fn().mockResolvedValue({
      success: true,
      appliedCount: 2,
      taskIds: ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'],
      appliedAt: '2026-10-18T12:00:00.000Z',
    });

    vi.spyOn(plannerHooks, 'useScheduleProposal').mockReturnValue({
      data: mockProposal,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof plannerHooks.useScheduleProposal>);

    vi.spyOn(plannerHooks, 'useApplySchedule').mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof plannerHooks.useApplySchedule>);
  });

  it('1. /planner route renders PlannerPage and does NOT render PlaceholderPage', async () => {
    // Keep your existing render and setup code unchanged.
    renderWithClient(<AppRoutes />, '/planner');

    expect(
      await screen.findByRole('heading', {
        name: /adaptive planner/i,
      }),
    ).toBeInTheDocument();

    // Keep the existing placeholder assertion.
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
  });

  it('2. renders header with date navigation and back-links to Today and Tasks', () => {
    renderWithClient(<PlannerPage />);

    expect(screen.getByRole('link', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByLabelText(/select target date/i)).toBeInTheDocument();
  });

  it('3. renders study window, capacity utilization, and external calendar warning when offline', () => {
    renderWithClient(<PlannerPage />);

    expect(screen.getByText('09:00 – 17:00')).toBeInTheDocument();
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getByText(/Google Calendar Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/90 \/ 120 min/i)).toBeInTheDocument();
  });

  it('4. displays proposed task blocks with priority, duration, defaulted estimate badges, and view links', () => {
    renderWithClient(<PlannerPage />);

    expect(screen.getByText('Implement Raft Heartbeat')).toBeInTheDocument();
    expect(screen.getByText('Cache invalidation write-up')).toBeInTheDocument();
    expect(screen.getByText('Provisional (30m default)')).toBeInTheDocument();
    expect(screen.getAllByText('View Details →')).toHaveLength(2);
  });

  it('5. renders unscheduled tasks with explicit reason descriptions', () => {
    renderWithClient(<PlannerPage />);

    expect(screen.getByText('Deploy to Kubernetes Cluster')).toBeInTheDocument();
    expect(screen.getByText(/Prerequisites incomplete \(1 prerequisite remaining\)/i)).toBeInTheDocument();
    expect(screen.getByText('Read Consensus Paper')).toBeInTheDocument();
    expect(screen.getByText(/Daily study target of 120 minutes reached/i)).toBeInTheDocument();
  });

  it('6. discard action clears proposal and does not call apply mutation', () => {
    renderWithClient(<PlannerPage />);

    const discardBtn = screen.getByRole('button', { name: /discard/i });
    fireEvent.click(discardBtn);

    expect(screen.getByText('Proposal Discarded')).toBeInTheDocument();
    expect(screen.getByText(/No task schedules or statuses were modified/i)).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('7. apply schedule requires explicit confirmation via modal before mutating', async () => {
    renderWithClient(<PlannerPage />);

    const applyBtn = screen.getByRole('button', { name: /apply schedule/i });
    fireEvent.click(applyBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: /confirm schedule application/i })).toBeInTheDocument();
    expect(screen.getByText(/Total Work Duration:/i)).toBeInTheDocument();

    // Confirm button inside modal
    const confirmBtn = screen.getByRole('button', { name: /confirm & apply/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        proposalId: '00000000-0000-0000-0000-000000000099',
        targetDate: expect.any(String),
        blocks: [
          {
            taskId: '00000000-0000-0000-0000-000000000001',
            scheduledStart: '2026-10-18T09:00:00.000Z',
            scheduledEnd: '2026-10-18T10:00:00.000Z',
            expectedUpdatedAt: '2026-10-17T12:00:00.000Z',
          },
          {
            taskId: '00000000-0000-0000-0000-000000000002',
            scheduledStart: '2026-10-18T11:00:00.000Z',
            scheduledEnd: '2026-10-18T11:30:00.000Z',
            expectedUpdatedAt: '2026-10-17T12:00:00.000Z',
          },
        ],
      });
    });
  });

  it('8. displays conflict/stale proposal error banner with refresh action when mutation rejects', async () => {
    mutateAsyncMock.mockRejectedValueOnce(
      new Error('One or more tasks were modified after the proposal was generated.')
    );

    renderWithClient(<PlannerPage />);

    fireEvent.click(screen.getByRole('button', { name: /apply schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm & apply/i }));

    await waitFor(() => {
      expect(screen.getByText(/Schedule Conflict or Stale Proposal/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh proposal now/i })).toBeInTheDocument();
    });
  });
});
