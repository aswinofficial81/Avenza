import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FocusHistoryPage } from './FocusHistoryPage';
import * as focusHooks from '../features/focus/useFocusSession';
import type { FocusSessionDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
    isSignedIn: true,
  }),
}));

const mockSessions: FocusSessionDto[] = [
  {
    id: 's-1',
    user_id: 'user-1',
    task_id: 't-1',
    session_type: 'deep_work',
    status: 'completed',
    started_at: '2026-10-03T08:00:00.000Z',
    ended_at: '2026-10-03T08:45:00.000Z',
    planned_minutes: 45,
    actual_minutes: 45,
    notes: 'Completed raft leader election',
    created_at: '2026-10-03T08:00:00.000Z',
    updated_at: '2026-10-03T08:45:00.000Z',
    task: {
      id: 't-1',
      title: 'Raft Consensus Implementation',
      status: 'in_progress',
      priority: 'high',
      task_type: 'project',
    },
  },
  {
    id: 's-2',
    user_id: 'user-1',
    task_id: 't-2',
    session_type: 'pomodoro',
    status: 'cancelled',
    started_at: '2026-10-03T09:00:00.000Z',
    ended_at: '2026-10-03T09:08:00.000Z',
    planned_minutes: 25,
    actual_minutes: 0,
    notes: 'Interrupted by urgent bug',
    created_at: '2026-10-03T09:00:00.000Z',
    updated_at: '2026-10-03T09:08:00.000Z',
    task: {
      id: 't-2',
      title: 'Documentation Review',
      status: 'inbox',
      priority: 'low',
      task_type: 'study',
    },
  },
];

describe('FocusHistoryPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FocusHistoryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders empty state when no historical sessions exist', () => {
    vi.spyOn(focusHooks, 'useFocusSessions').mockReturnValue({
      data: {
        data: [],
        pagination: { page: 1, pageSize: 15, total: 0, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useFocusSessions>);

    renderComponent();

    expect(screen.getByText('Focus Session History')).toBeInTheDocument();
    expect(screen.getByText('No focus sessions recorded')).toBeInTheDocument();
  });

  it('renders historical sessions in table with date, task, planned, actual, and status', () => {
    vi.spyOn(focusHooks, 'useFocusSessions').mockReturnValue({
      data: {
        data: mockSessions,
        pagination: { page: 1, pageSize: 15, total: 2, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useFocusSessions>);

    renderComponent();

    expect(screen.getByText('Raft Consensus Implementation')).toBeInTheDocument();
    expect(screen.getByText('Documentation Review')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('45m').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Showing 2 of 2 sessions')).toBeInTheDocument();
  });
});
