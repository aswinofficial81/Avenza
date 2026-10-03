import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TermsPage } from './TermsPage';
import { SubjectsPage } from './SubjectsPage';
import { SubjectDetailPage } from './SubjectDetailPage';
import { AcademicsOverviewPage } from './AcademicsOverviewPage';
import * as academicsHooks from '../features/academics/useAcademics';
import type {
  AcademicsOverviewDto,
  SubjectDto,
  SubjectTopicDto,
  TermDto,
} from '@avenza/shared';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const mockTerms: TermDto[] = [
  {
    id: 'term-1',
    user_id: 'user-1',
    academic_year_id: null,
    name: 'Fall 2026',
    code: 'F26',
    start_date: '2026-08-15',
    end_date: '2026-12-15',
    status: 'active',
    is_current: true,
    notes: 'Primary academic semester',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    subject_count: 2,
  },
];

const mockSubjects: SubjectDto[] = [
  {
    id: 'subj-1',
    user_id: 'user-1',
    term_id: 'term-1',
    name: 'Operating Systems',
    code: 'CS401',
    description: 'Process management, memory virtualization, concurrency',
    instructor: 'Dr. Dijkstra',
    credits: 4.0,
    color: null,
    status: 'active',
    notes: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    coverage: {
      total_topics: 4,
      covered_topics: 2,
      in_progress_topics: 1,
      needs_review_topics: 1,
      not_started_topics: 0,
      coverage_percentage: 50,
    },
  },
];

const mockTopics: SubjectTopicDto[] = [
  {
    id: 'top-1',
    user_id: 'user-1',
    subject_id: 'subj-1',
    name: 'Virtual Memory & Paging',
    description: 'TLBs, multi-level page tables, demand paging',
    order_index: 1,
    status: 'covered',
    importance: 'critical',
    estimated_minutes: 120,
    resources: [],
    notes: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'top-2',
    user_id: 'user-1',
    subject_id: 'subj-1',
    name: 'Semaphore Concurrency',
    description: 'Dining philosophers and producer-consumer',
    order_index: 2,
    status: 'in_progress',
    importance: 'high',
    estimated_minutes: 90,
    resources: [],
    notes: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
];

const mockOverview: AcademicsOverviewDto = {
  active_term: mockTerms[0] ?? null,
  subjects: mockSubjects,
  upcoming_exams: [
    {
      id: 'exam-1',
      user_id: 'user-1',
      term_id: 'term-1',
      subject_id: 'subj-1',
      title: 'OS Midterm Examination',
      exam_type: 'midterm',
      exam_date: '2026-10-20T10:00:00Z',
      duration_minutes: 120,
      location: 'Room 302',
      weight_percent: 25,
      status: 'planned',
      notes: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
  ],
  upcoming_assessments: [
    {
      id: 'asmt-1',
      user_id: 'user-1',
      term_id: 'term-1',
      subject_id: 'subj-1',
      title: 'Virtual Memory Paging Lab',
      assessment_type: 'lab',
      description: null,
      due_at: '2026-10-15T23:59:00Z',
      max_marks: 50,
      obtained_marks: null,
      weight_percent: 15,
      status: 'in_progress',
      notes: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    },
  ],
  overall_coverage: {
    total_topics: 4,
    covered_topics: 2,
    in_progress_topics: 1,
    needs_review_topics: 1,
    not_started_topics: 0,
    coverage_percentage: 50,
  },
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Academics Frontend Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TermsPage renders terms list and opens Create Term modal', () => {
    vi.spyOn(academicsHooks, 'useTerms').mockReturnValue({
      data: mockTerms,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useTerms>);

    vi.spyOn(academicsHooks, 'useCreateTerm').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof academicsHooks.useCreateTerm>);

    renderWithProviders(<TermsPage />);

    expect(screen.getByText('Academic Terms')).toBeInTheDocument();
    expect(screen.getByText('Fall 2026')).toBeInTheDocument();
    expect(screen.getByText('2 subjects')).toBeInTheDocument();
    expect(screen.getByText('Current Term')).toBeInTheDocument();

    // Click "New Term" button
    const newTermBtn = screen.getByRole('button', { name: /new term/i });
    fireEvent.click(newTermBtn);
    expect(screen.getByText('Create Academic Term')).toBeInTheDocument();
  });

  it('SubjectsPage renders subjects list with syllabus coverage and opens modal', () => {
    vi.spyOn(academicsHooks, 'useTerms').mockReturnValue({
      data: mockTerms,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useTerms>);

    vi.spyOn(academicsHooks, 'useSubjects').mockReturnValue({
      data: mockSubjects,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useSubjects>);

    vi.spyOn(academicsHooks, 'useCreateSubject').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof academicsHooks.useCreateSubject>);

    renderWithProviders(<SubjectsPage />);

    expect(screen.getByText('Academic Subjects')).toBeInTheDocument();
    expect(screen.getByText('Operating Systems')).toBeInTheDocument();
    expect(screen.getByText('CS401')).toBeInTheDocument();
    expect(screen.getByText('Dr. Dijkstra')).toBeInTheDocument();
    expect(screen.getByText(/2\/4 topics \(50%\)/)).toBeInTheDocument();

    const newSubjBtn = screen.getByRole('button', { name: /new subject/i });
    fireEvent.click(newSubjBtn);
    expect(screen.getByText('Add Academic Subject')).toBeInTheDocument();
  });

  it('SubjectDetailPage renders subject details, topics, and syllabus coverage', () => {
    vi.spyOn(academicsHooks, 'useSubjectDetailBundle').mockReturnValue({
      data: {
        subject: mockSubjects[0]!,
        topics: mockTopics,
        assessments: mockOverview.upcoming_assessments,
        exams: mockOverview.upcoming_exams,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useSubjectDetailBundle>);

    vi.spyOn(academicsHooks, 'useUpdateTopic').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof academicsHooks.useUpdateTopic>);

    vi.spyOn(academicsHooks, 'useDeleteTopic').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof academicsHooks.useDeleteTopic>);

    renderWithProviders(<SubjectDetailPage />);

    // Subject header
    expect(screen.getByRole('heading', { level: 1, name: 'Operating Systems' })).toBeInTheDocument();
    expect(screen.getByText('Instructor: Dr. Dijkstra')).toBeInTheDocument();

    // Coverage dashboard strictly labeled "Syllabus Coverage"
    expect(screen.getAllByText('Syllabus Coverage').length).toBeGreaterThan(0);
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Topics list
    expect(screen.getByText('Virtual Memory & Paging')).toBeInTheDocument();
    expect(screen.getByText('Semaphore Concurrency')).toBeInTheDocument();

    // Tab switching
    const assessmentsTab = screen.getByRole('button', { name: /assessments/i });
    fireEvent.click(assessmentsTab);
    expect(screen.getByText('Virtual Memory Paging Lab')).toBeInTheDocument();

    const examsTab = screen.getByRole('button', { name: /exams/i });
    fireEvent.click(examsTab);
    expect(screen.getByText('OS Midterm Examination')).toBeInTheDocument();
  });

  it('AcademicsOverviewPage answers all 5 core academic questions', () => {
    vi.spyOn(academicsHooks, 'useAcademicsOverview').mockReturnValue({
      data: mockOverview,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof academicsHooks.useAcademicsOverview>);

    renderWithProviders(<AcademicsOverviewPage />);

    expect(screen.getByText('Academics Overview')).toBeInTheDocument();

    // 1. Current Term
    expect(screen.getByText('Fall 2026')).toBeInTheDocument();

    // 2. Enrolled Subjects
    expect(screen.getByText(/Enrolled Subjects/)).toBeInTheDocument();
    expect(screen.getByText('Operating Systems')).toBeInTheDocument();

    // 3. Upcoming Exams
    expect(screen.getByText('OS Midterm Examination')).toBeInTheDocument();

    // 4. Upcoming Assessments
    expect(screen.getByText('Virtual Memory Paging Lab')).toBeInTheDocument();

    // 5. Syllabus Coverage
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
