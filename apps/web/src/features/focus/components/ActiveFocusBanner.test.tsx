import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActiveFocusBanner } from './ActiveFocusBanner';
import * as focusHooks from '../useFocusSession';
import type { FocusSessionDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
    isSignedIn: true,
  }),
}));

const mockActiveSession: FocusSessionDto = {
  id: 'session-123',
  user_id: 'user-1',
  task_id: 'task-1',
  session_type: 'deep_work',
  status: 'active',
  started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  ended_at: null,
  planned_minutes: 30,
  actual_minutes: null,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  task: {
    id: 'task-1',
    title: 'Distributed System Consensus',
    status: 'in_progress',
    priority: 'high',
    task_type: 'project',
  },
};

describe('ActiveFocusBanner Component', () => {
  const renderWithRouter = (initialRoute = '/today') => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <ActiveFocusBanner />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders nothing when no active focus session exists', () => {
    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    const { container } = renderWithRouter('/today');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when user is already on the /focus page', () => {
    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: mockActiveSession,
      isLoading: false,
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    const { container } = renderWithRouter('/focus');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders persistent calm banner when active session exists on other pages', () => {
    vi.spyOn(focusHooks, 'useActiveFocusSession').mockReturnValue({
      data: mockActiveSession,
      isLoading: false,
    } as unknown as ReturnType<typeof focusHooks.useActiveFocusSession>);

    renderWithRouter('/today');

    expect(screen.getByText('DEEP WORK')).toBeInTheDocument();
    expect(screen.getByText('Distributed System Consensus')).toBeInTheDocument();
    expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Session/i })).toHaveAttribute('href', '/focus');
  });
});
