import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FocusPage } from './FocusPage';
import * as focusHooks from '../features/focus/useFocusSession';
import type { FocusSessionDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
    isSignedIn: true,
  }),
}));

const mockActiveSession: FocusSessionDto = {
  id: '22222222-2222-2222-2222-222222222222',
  user_id: 'user_123',
  task_id: '11111111-1111-1111-1111-111111111111',
  session_type: 'deep_work',
  status: 'active',
  started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
  ended_at: null,
  planned_minutes: 45,
  actual_minutes: null,
  notes: 'Testing distributed tracing',
  created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  task: {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Implement Raft Consensus Algorithm',
    status: 'in_progress',
    priority: 'high',
    task_type: 'project',
    goal_title: 'Master Distributed Systems',
  },
};

describe('FocusPage Component', () => {
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
          <FocusPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders calm empty state when no active session exists', () => {
    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    renderComponent();

    expect(screen.getByText('Focus Session')).toBeInTheDocument();
    expect(screen.getByText('No active focus session')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Start Focus/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Focus History')).toBeInTheDocument();
  });

  it('renders active timer and session details when active session is present', () => {
    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: mockActiveSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    renderComponent();

    // Verify timer & session content
    expect(screen.getByRole('region', { name: /Focus Timer/i })).toBeInTheDocument();
    expect(screen.getByText('Target: 45 min')).toBeInTheDocument();
    expect(screen.getByText('Implement Raft Consensus Algorithm')).toBeInTheDocument();
    expect(screen.getByText(/Deep Work/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete Session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Session/i })).toBeInTheDocument();
  });

  it('calls complete session mutation when clicking Complete Session button', async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({
      ...mockActiveSession,
      status: 'completed',
      actual_minutes: 15,
    });

    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: mockActiveSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    vi.spyOn(focusHooks, 'useCompleteFocusSession').mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof focusHooks.useCompleteFocusSession>);

    renderComponent();

    const completeBtn = screen.getByRole('button', { name: /Complete Session/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        id: mockActiveSession.id,
        notes: undefined,
      });
    });
  });

  it('requires confirmation before cancelling an active session', async () => {
    const cancelMutateAsyncMock = vi.fn().mockResolvedValue({
      ...mockActiveSession,
      status: 'cancelled',
      actual_minutes: 0,
    });

    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: mockActiveSession,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    vi.spyOn(focusHooks, 'useCancelFocusSession').mockReturnValue({
      mutateAsync: cancelMutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof focusHooks.useCancelFocusSession>);

    renderComponent();

    const cancelBtn = screen.getByRole('button', { name: /Cancel Session/i });
    fireEvent.click(cancelBtn);

    // Cancel was not called yet; it prompted for confirmation
    expect(cancelMutateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Confirm Cancel\?/i })).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: /Confirm Cancel\?/i }));

    await waitFor(() => {
      expect(cancelMutateAsyncMock).toHaveBeenCalledWith({
        id: mockActiveSession.id,
        notes: undefined,
      });
    });
  });

  it('opens StartFocusModal when clicking Start Focus from empty state', async () => {
    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    renderComponent();

    const startBtns = screen.getAllByRole('button', { name: /Start Focus/i });
    fireEvent.click(startBtns[0]!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Start Focus Session')).toBeInTheDocument();
  });
});
