import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SkillsPage } from './SkillsPage';
import * as skillsHooks from '../features/skills/useSkills';
import type { SkillWithMasteryDto } from '@avenza/shared';

// Mock Clerk auth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockSkills: SkillWithMasteryDto[] = [
  {
    skill: {
      id: '11111111-1111-1111-1111-111111111111',
      user_id: 'user_123',
      parent_skill_id: null,
      name: 'PostgreSQL',
      slug: 'postgresql',
      description: 'Relational database architecture and query optimization',
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
      explanation: 'Proficient demonstrated mastery based on 5 evidence items.',
      calculated_at: '2026-10-03T10:00:00.000Z',
      recent_activity_at: '2026-10-01T00:00:00.000Z',
    },
  },
  {
    skill: {
      id: '22222222-2222-2222-2222-222222222222',
      user_id: 'user_123',
      parent_skill_id: '11111111-1111-1111-1111-111111111111',
      name: 'B+ Tree Indexing',
      slug: 'b-tree-indexing',
      description: 'Storage engine index structures',
      category: 'Databases',
      status: 'active',
      source: 'user',
      created_at: '2026-10-02T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
      parent_skill: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'PostgreSQL',
        slug: 'postgresql',
      },
    },
    mastery: {
      state: 'learning',
      score: 34,
      confidence: 'medium',
      evidence_count: 2,
      verified_evidence_count: 1,
      health: 'developing',
      explanation: 'Learning state based on coursework topics.',
      calculated_at: '2026-10-03T10:00:00.000Z',
      recent_activity_at: '2026-10-02T00:00:00.000Z',
    },
  },
];

const renderSkillsPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SkillsPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('SkillsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skills page title and statistics summary', () => {
    vi.spyOn(skillsHooks, 'useSkills').mockReturnValue({
      data: mockSkills,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.spyOn(skillsHooks, 'useArchiveSkill').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderSkillsPage();

    expect(screen.getByRole('heading', { level: 1, name: /Skills & Capabilities/i })).toBeInTheDocument();
    expect(screen.getByText(/Total Capabilities/i)).toBeInTheDocument();
    expect(screen.getAllByText('PostgreSQL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('B+ Tree Indexing')).toBeInTheDocument();
    expect(screen.getAllByText(/PROFICIENT/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/LEARNING/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no skills are defined', () => {
    vi.spyOn(skillsHooks, 'useSkills').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.spyOn(skillsHooks, 'useArchiveSkill').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderSkillsPage();

    expect(screen.getByText(/No skills found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create First Skill/i })).toBeInTheDocument();
  });

  it('opens create modal when Add Skill is clicked', () => {
    vi.spyOn(skillsHooks, 'useSkills').mockReturnValue({
      data: mockSkills,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.spyOn(skillsHooks, 'useCreateSkill').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.spyOn(skillsHooks, 'useArchiveSkill').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderSkillsPage();

    const addBtn = screen.getByRole('button', { name: /Add Skill/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/Create New Capability \/ Skill/i)).toBeInTheDocument();
  });

  it('renders error state on query failure', () => {
    vi.spyOn(skillsHooks, 'useSkills').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    renderSkillsPage();

    expect(screen.getByText(/Failed to load skills/i)).toBeInTheDocument();
  });
});
