import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DsaProblemDetailPage } from './DsaProblemDetailPage';
import * as problemDetailHook from '../hooks/use-dsa-problem-detail';
import * as dsaApiModule from '../../../lib/api/dsa';
import type { DsaProblemDetailDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockProblemDetail: DsaProblemDetailDto = {
  problem: {
    id: 'prob-101',
    user_id: 'user_1',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Find two numbers that add up to target',
    source: 'imported',
    status: 'active',
    external_url: 'https://leetcode.com/problems/two-sum',
    difficulty: 'easy',
    estimated_minutes: 20,
    last_solved_at: '2026-10-01T10:00:00.000Z',
    last_attempt_at: '2026-10-01T10:00:00.000Z',
    attempt_count: 3,
    solved_count: 2,
    failed_count: 1,
    revision_count: 1,
    review_stage: 1,
    next_review_at: '2026-10-08T10:00:00.000Z',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
  },
  topics: [
    {
      id: 'topic-1',
      user_id: 'user_1',
      name: 'Arrays & Hashing',
      slug: 'arrays-and-hashing',
      status: 'active',
      parent_topic_id: null,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    },
  ],
  skills: [
    {
      id: 'skill-1',
      name: 'Hash Tables',
      slug: 'hash-tables',
    },
  ],
  goals: [
    {
      id: 'goal-1',
      title: 'Crack FAANG Interview',
      status: 'active',
    },
  ],
  tasks: [],
  recent_attempts: [
    {
      id: 'att-1',
      problem_id: 'prob-101',
      user_id: 'user_1',
      status: 'solved',
      started_at: null,
      submitted_at: null,
      occurred_at: '2026-10-01T10:00:00.000Z',
      recorded_at: '2026-10-01T10:00:00.000Z',
      solve_time_minutes: 15,
      language: 'TypeScript',
      notes: 'Used hash map for O(n) lookup',
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'att-2',
      problem_id: 'prob-101',
      user_id: 'user_1',
      status: 'failed',
      started_at: null,
      submitted_at: null,
      occurred_at: '2026-09-30T10:00:00.000Z',
      recorded_at: '2026-09-30T10:00:00.000Z',
      solve_time_minutes: 25,
      language: 'TypeScript',
      notes: 'Brute force timed out',
      created_at: '2026-09-30T10:00:00.000Z',
      updated_at: '2026-09-30T10:00:00.000Z',
    },
  ],
};

function renderPage(queryClient: QueryClient, initialRoute = '/dsa/problems/prob-101') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/dsa/problems/:problemId" element={<DsaProblemDetailPage />} />
          <Route path="/dsa/problems" element={<div>Problems List Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DsaProblemDetailPage Component', () => {
  let queryClient: QueryClient;
  const mockRefetch = vi.fn();
  const mockCreateAttempt = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.restoreAllMocks();
    mockRefetch.mockReset();
    mockCreateAttempt.mockReset().mockResolvedValue({
      id: 'att-3',
      problem_id: 'prob-101',
      user_id: 'user_1',
      status: 'solved',
      solve_time_minutes: 15,
      language: 'TypeScript',
      notes: null,
      occurred_at: '2026-10-04T10:00:00.000Z',
      recorded_at: '2026-10-04T10:00:00.000Z',
      started_at: null,
      submitted_at: null,
      created_at: '2026-10-04T10:00:00.000Z',
      updated_at: '2026-10-04T10:00:00.000Z',
    });

    vi.spyOn(dsaApiModule, 'useDsaApi').mockReturnValue({
      createAttempt: mockCreateAttempt,
    } as unknown as ReturnType<typeof dsaApiModule.useDsaApi>);
  });

  it('renders loading state properly', () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    expect(screen.getByTestId('dsa-detail-loading')).toBeInTheDocument();
  });

  it('renders error state properly with retry button', () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load problem'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    expect(screen.getByTestId('dsa-detail-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load problem')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders not found state when data is empty', () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    expect(screen.getByTestId('dsa-detail-not-found')).toBeInTheDocument();
    expect(screen.getByText('Problem Not Found')).toBeInTheDocument();
  });

  it('renders populated problem details with difficulty, source, and topics', () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: mockProblemDetail,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    expect(screen.getByRole('heading', { level: 1, name: /Two Sum/i })).toBeInTheDocument();
    expect(screen.getByText(/easy/i)).toBeInTheDocument();
    expect(screen.getByText(/imported/i)).toBeInTheDocument();
    expect(screen.getByText('Arrays & Hashing')).toBeInTheDocument();
    expect(screen.getByText('Hash Tables')).toBeInTheDocument();
    expect(screen.getByText('Crack FAANG Interview')).toBeInTheDocument();
  });

  it('renders revision information and performance metrics', () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: mockProblemDetail,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    // Spaced repetition section
    expect(screen.getByText('Spaced Repetition')).toBeInTheDocument();
    expect(screen.getByText(/Stage 1/i)).toBeInTheDocument();

    // Metrics
    expect(screen.getByText('Total Attempts')).toBeInTheDocument();
    expect(screen.getByText('Solve Rate')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument(); // 2 / 3 = 67%
  });

  it('renders attempt history with status and notes', () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: mockProblemDetail,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    expect(screen.getByText('Attempt History')).toBeInTheDocument();
    expect(screen.getByText('2 attempts')).toBeInTheDocument();
    expect(screen.getByText('Used hash map for O(n) lookup')).toBeInTheDocument();
    expect(screen.getByText('Brute force timed out')).toBeInTheDocument();
  });

  it('creates a solved attempt successfully via form', async () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: mockProblemDetail,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    const recordBtn = screen.getByRole('button', { name: /Record Attempt/i });
    fireEvent.click(recordBtn);

    expect(screen.getByText('Record New Attempt')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Attempt/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockCreateAttempt).toHaveBeenCalledWith(
        'prob-101',
        expect.objectContaining({
          status: 'solved',
          solve_time_minutes: 15,
        })
      );
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('creates a failed attempt successfully via form', async () => {
    vi.spyOn(problemDetailHook, 'useDsaProblemDetail').mockReturnValue({
      data: mockProblemDetail,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof problemDetailHook.useDsaProblemDetail>);

    renderPage(queryClient);

    const recordBtn = screen.getByRole('button', { name: /Record Attempt/i });
    fireEvent.click(recordBtn);

    const statusSelect = screen.getByDisplayValue('Solved');
    fireEvent.change(statusSelect, { target: { value: 'failed' } });

    const notesInput = screen.getByPlaceholderText(/Record your thoughts/i);
    fireEvent.change(notesInput, { target: { value: 'Got stuck on edge cases' } });

    const saveBtn = screen.getByRole('button', { name: /Save Attempt/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockCreateAttempt).toHaveBeenCalledWith(
        'prob-101',
        expect.objectContaining({
          status: 'failed',
          notes: 'Got stuck on edge cases',
        })
      );
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
