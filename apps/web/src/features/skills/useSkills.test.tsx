import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ApiSuccessResponse, SkillWithMasteryDto } from '@avenza/shared';
import { SkillsPage } from '../../routes/SkillsPage';
import { useSkills } from './useSkills';

const apiGet = vi.fn();

// Only the transport is mocked. useSkills and SkillsPage are the real implementations,
// and the mocked transport returns the exact envelope the Fastify controller sends.
vi.mock('../../lib/api-client', () => ({
  useApiClient: () => ({ get: apiGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
}));

const skillItem: SkillWithMasteryDto = {
  skill: {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: 'user_123',
    parent_skill_id: null,
    name: 'PostgreSQL',
    slug: 'postgresql',
    description: 'Relational database architecture',
    category: 'Databases',
    status: 'active',
    source: 'user',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  },
  mastery: {
    state: 'proficient',
    score: 72,
    confidence: 'high',
    evidence_count: 5,
    verified_evidence_count: 3,
    health: 'healthy',
    explanation: 'Proficient based on 5 evidence items.',
    calculated_at: '2026-10-03T10:00:00.000Z',
    recent_activity_at: '2026-10-01T00:00:00.000Z',
  },
};

const envelope = (data: SkillWithMasteryDto[]): ApiSuccessResponse<SkillWithMasteryDto[]> => ({
  success: true,
  data,
});

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe('useSkills API contract', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('unwraps the {success, data} envelope into SkillWithMasteryDto[]', async () => {
    apiGet.mockResolvedValue(envelope([skillItem]));
    const client = makeClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSkills({ status: 'active' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toEqual([skillItem]);
    expect(apiGet).toHaveBeenCalledWith('/api/v1/skills?status=active');
  });

  it('returns [] (not the envelope) when the user has zero skills', async () => {
    apiGet.mockResolvedValue(envelope([]));
    const client = makeClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSkills(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('SkillsPage with the real useSkills hook', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={makeClient()}>
        <BrowserRouter>
          <SkillsPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders skills from an enveloped API response without crashing (original blank-screen bug)', async () => {
    apiGet.mockResolvedValue(envelope([skillItem]));
    renderPage();

    expect(await screen.findByText('PostgreSQL', { selector: 'a' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Skills & Capabilities/i })).toBeInTheDocument();
  });

  it('renders the loading state before the response resolves, without touching skills', () => {
    apiGet.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: /Skills & Capabilities/i })).toBeInTheDocument();
    expect(screen.queryByText(/No skills found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to load skills/i)).not.toBeInTheDocument();
  });

  it('renders the empty state when the API returns zero skills', async () => {
    apiGet.mockResolvedValue(envelope([]));
    renderPage();

    expect(await screen.findByText(/No skills found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create First Skill/i })).toBeInTheDocument();
  });

  it('renders the error state when the API request fails', async () => {
    apiGet.mockRejectedValue(new Error('Request failed with status 500'));
    renderPage();

    expect(await screen.findByText(/Failed to load skills/i)).toBeInTheDocument();
  });
});
