import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DsaPage } from './DsaPage';
import { DsaProblemsPage } from '../features/dsa/pages/DsaProblemsPage';
import { ThemeProvider } from '../lib/theme';

// Mock Clerk Auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('test-mock-token'),
  }),
}));

function renderWithProviders(_ui?: React.ReactElement, initialRoute = '/dsa') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/dsa" element={<DsaPage />} />
            <Route path="/dsa/problems" element={<DsaProblemsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe('DsaPage Runtime & URL Construction Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully loads /dsa without throwing "Invalid URL" error', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/dsa/overview')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              total_problems: 42,
              solved_problems: 28,
              attempted_problems: 35,
              revision_due_count: 4,
              weak_areas: [
                {
                  topic_id: 'top-1',
                  topic_name: 'Binary Search',
                  problem_count: 6,
                  failure_count: 3,
                  reason: 'High failure count',
                },
              ],
              recommended_problem: {
                id: 'prob-99',
                title: 'Search in Rotated Sorted Array',
                reason: 'Strengthen weak topic Binary Search',
              },
            },
          }),
        });
      }
      if (url.includes('/api/v1/dsa/problems')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'prob-99',
                user_id: 'user-1',
                title: 'Search in Rotated Sorted Array',
                slug: 'search-in-rotated-sorted-array',
                description: 'Binary search variant',
                difficulty: 'medium',
                source: 'system',
                status: 'active',
                external_url: null,
                estimated_minutes: 25,
                attempt_count: 3,
                solved_count: 1,
                failed_count: 2,
                last_attempt_at: null,
                last_solved_at: null,
                next_review_at: null,
                revision_count: 0,
                review_stage: 0,
                created_at: '2026-10-01T00:00:00.000Z',
                updated_at: '2026-10-01T00:00:00.000Z',
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    vi.stubGlobal('fetch', mockFetch);

    renderWithProviders(<DsaPage />);

    // Initial loading state
    expect(screen.getByText('Loading overview...')).toBeInTheDocument();
    expect(screen.getByText('Loading problems...')).toBeInTheDocument();

    // Verify successful render after API resolution
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getByText('Search in Rotated Sorted Array')).toBeInTheDocument();
      expect(screen.getByText('Binary Search')).toBeInTheDocument();
    });

    // Check calls made with valid absolute URLs
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/(localhost|127\.0\.0\.1):3005\/api\/v1\/dsa\/overview/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-mock-token',
        }),
      })
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/(localhost|127\.0\.0\.1):3005\/api\/v1\/dsa\/problems/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-mock-token',
        }),
      })
    );

    // Verify NO "Invalid URL" anywhere
    expect(screen.queryByText(/Invalid URL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to construct 'URL'/i)).not.toBeInTheDocument();
  });

  it('renders clean error state if API fails, with no unhandled URL exceptions', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Backend service unavailable' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    renderWithProviders(<DsaPage />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading overview: Backend service unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/Error loading problems: Backend service unavailable/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Invalid URL/i)).not.toBeInTheDocument();
  });

  it('renders clean empty state on /dsa/problems when list is empty', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/dsa/problems')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: [],
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    renderWithProviders(<DsaProblemsPage />, '/dsa/problems');

    await waitFor(() => {
      expect(
        screen.getByText(/No problems found. Create your first DSA problem to get started./i)
      ).toBeInTheDocument();
    });
  });

  it('supports dark theme rendering without visual layout regression', async () => {
    const queryClient = new QueryClient();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          total_problems: 0,
          solved_problems: 0,
          attempted_problems: 0,
          revision_due_count: 0,
          weak_areas: [],
          recommended_problem: null,
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <ThemeProvider defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dsa']}>
            <DsaPage />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('DSA Overview')).toBeInTheDocument();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
