import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import type {
  AcademicYearDto,
  AcademicsOverviewDto,
  ApiSuccessResponse,
  AssessmentDto,
  ExamDto,
  SubjectDto,
  SubjectTopicDto,
  TermDto,
} from '@avenza/shared';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const academicsKeys = {
  all: ['academics'] as const,
  overview: () => ['academics', 'overview'] as const,
  years: () => ['academics', 'years'] as const,
  terms: () => ['academics', 'terms'] as const,
  term: (id: string) => ['academics', 'terms', id] as const,
  subjects: (termId?: string) => ['academics', 'subjects', { termId }] as const,
  subject: (id: string) => ['academics', 'subjects', 'detail', id] as const,
  subjectBundle: (id: string) => ['academics', 'subjects', 'bundle', id] as const,
  topics: (subjectId: string) => ['academics', 'topics', subjectId] as const,
  assessments: (termId?: string, subjectId?: string) =>
    ['academics', 'assessments', { termId, subjectId }] as const,
  assessment: (id: string) => ['academics', 'assessments', 'detail', id] as const,
  exams: (termId?: string, subjectId?: string) => ['academics', 'exams', { termId, subjectId }] as const,
  exam: (id: string) => ['academics', 'exams', 'detail', id] as const,
};

// ─── Academics Overview ──────────────────────────────────────────────────────

export function useAcademicsOverview() {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.overview(),
    queryFn: async (): Promise<AcademicsOverviewDto> => {
      const res = await api.get<ApiSuccessResponse<AcademicsOverviewDto>>('/api/v1/academics/overview');
      return res.data;
    },
    staleTime: 10000,
  });
}

// ─── Academic Years ─────────────────────────────────────────────────────────

export function useAcademicYears() {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.years(),
    queryFn: async (): Promise<AcademicYearDto[]> => {
      const res = await api.get<ApiSuccessResponse<AcademicYearDto[]>>('/api/v1/academic-years');
      return res.data;
    },
    staleTime: 30000,
  });
}

export function useCreateAcademicYear() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<AcademicYearDto>) => {
      const res = await api.post<ApiSuccessResponse<AcademicYearDto>>('/api/v1/academic-years', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicsKeys.years() });
    },
  });
}

// ─── Terms ──────────────────────────────────────────────────────────────────

export function useTerms() {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.terms(),
    queryFn: async (): Promise<TermDto[]> => {
      const res = await api.get<ApiSuccessResponse<TermDto[]>>('/api/v1/terms');
      return res.data;
    },
    staleTime: 20000,
  });
}

export function useTerm(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.term(id || ''),
    queryFn: async (): Promise<TermDto> => {
      if (!id) throw new Error('Term ID is required');
      const res = await api.get<ApiSuccessResponse<TermDto>>(`/api/v1/terms/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateTerm() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<TermDto>) => {
      const res = await api.post<ApiSuccessResponse<TermDto>>('/api/v1/terms', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicsKeys.terms() });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useUpdateTerm() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TermDto> }) => {
      const res = await api.patch<ApiSuccessResponse<TermDto>>(`/api/v1/terms/${id}`, data);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: academicsKeys.terms() });
      queryClient.invalidateQueries({ queryKey: academicsKeys.term(updated.id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useDeleteTerm() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ApiSuccessResponse<{ deleted: boolean }>>(`/api/v1/terms/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicsKeys.terms() });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

// ─── Subjects ───────────────────────────────────────────────────────────────

export function useSubjects(termId?: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.subjects(termId),
    queryFn: async (): Promise<SubjectDto[]> => {
      const url = termId ? `/api/v1/subjects?termId=${termId}` : '/api/v1/subjects';
      const res = await api.get<ApiSuccessResponse<SubjectDto[]>>(url);
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useSubject(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.subject(id || ''),
    queryFn: async (): Promise<SubjectDto> => {
      if (!id) throw new Error('Subject ID is required');
      const res = await api.get<ApiSuccessResponse<SubjectDto>>(`/api/v1/subjects/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useSubjectDetailBundle(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.subjectBundle(id || ''),
    queryFn: async (): Promise<{
      subject: SubjectDto;
      topics: SubjectTopicDto[];
      assessments: AssessmentDto[];
      exams: ExamDto[];
    }> => {
      if (!id) throw new Error('Subject ID is required');
      const res = await api.get<
        ApiSuccessResponse<{
          subject: SubjectDto;
          topics: SubjectTopicDto[];
          assessments: AssessmentDto[];
          exams: ExamDto[];
        }>
      >(`/api/v1/subjects/${id}/bundle`);
      return res.data;
    },
    enabled: Boolean(id),
    staleTime: 10000,
  });
}

export function useCreateSubject() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<SubjectDto>) => {
      const res = await api.post<ApiSuccessResponse<SubjectDto>>('/api/v1/subjects', payload);
      return res.data;
    },
    onSuccess: (newSubject) => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'subjects'] });
      queryClient.invalidateQueries({ queryKey: academicsKeys.term(newSubject.term_id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useUpdateSubject() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubjectDto> }) => {
      const res = await api.patch<ApiSuccessResponse<SubjectDto>>(`/api/v1/subjects/${id}`, data);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'subjects'] });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subject(updated.id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(updated.id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useDeleteSubject() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ApiSuccessResponse<{ deleted: boolean }>>(`/api/v1/subjects/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'subjects'] });
      queryClient.invalidateQueries({ queryKey: academicsKeys.terms() });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

// ─── Topics ─────────────────────────────────────────────────────────────────

export function useTopics(subjectId: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.topics(subjectId || ''),
    queryFn: async (): Promise<SubjectTopicDto[]> => {
      if (!subjectId) return [];
      const res = await api.get<ApiSuccessResponse<SubjectTopicDto[]>>(`/api/v1/subjects/${subjectId}/topics`);
      return res.data;
    },
    enabled: Boolean(subjectId),
  });
}

export function useCreateTopic() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subjectId, data }: { subjectId: string; data: Partial<SubjectTopicDto> }) => {
      const res = await api.post<ApiSuccessResponse<SubjectTopicDto>>(`/api/v1/subjects/${subjectId}/topics`, data);
      return res.data;
    },
    onSuccess: (newTopic) => {
      queryClient.invalidateQueries({ queryKey: academicsKeys.topics(newTopic.subject_id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subject(newTopic.subject_id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(newTopic.subject_id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useUpdateTopic() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubjectTopicDto> }) => {
      const res = await api.patch<ApiSuccessResponse<SubjectTopicDto>>(`/api/v1/topics/${id}`, data);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: academicsKeys.topics(updated.subject_id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subject(updated.subject_id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(updated.subject_id) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useDeleteTopic() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, subjectId }: { id: string; subjectId: string }) => {
      const res = await api.delete<ApiSuccessResponse<{ deleted: boolean }>>(`/api/v1/topics/${id}`);
      return { ...res.data, subjectId };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: academicsKeys.topics(res.subjectId) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subject(res.subjectId) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(res.subjectId) });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

// ─── Assessments ────────────────────────────────────────────────────────────

export function useAssessments(termId?: string, subjectId?: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.assessments(termId, subjectId),
    queryFn: async (): Promise<AssessmentDto[]> => {
      const params = new URLSearchParams();
      if (termId) params.set('termId', termId);
      if (subjectId) params.set('subjectId', subjectId);
      const queryStr = params.toString();
      const url = queryStr ? `/api/v1/assessments?${queryStr}` : '/api/v1/assessments';
      const res = await api.get<ApiSuccessResponse<AssessmentDto[]>>(url);
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useCreateAssessment() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<AssessmentDto> & { topic_ids?: string[] }) => {
      const res = await api.post<ApiSuccessResponse<AssessmentDto>>('/api/v1/assessments', payload);
      return res.data;
    },
    onSuccess: (newAsmt) => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'assessments'] });
      if (newAsmt.subject_id) {
        queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(newAsmt.subject_id) });
      }
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useUpdateAssessment() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<AssessmentDto> & { topic_ids?: string[] };
    }) => {
      const res = await api.patch<ApiSuccessResponse<AssessmentDto>>(`/api/v1/assessments/${id}`, data);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'assessments'] });
      if (updated.subject_id) {
        queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(updated.subject_id) });
      }
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useDeleteAssessment() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ApiSuccessResponse<{ deleted: boolean }>>(`/api/v1/assessments/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'assessments'] });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

// ─── Exams ──────────────────────────────────────────────────────────────────

export function useExams(termId?: string, subjectId?: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: academicsKeys.exams(termId, subjectId),
    queryFn: async (): Promise<ExamDto[]> => {
      const params = new URLSearchParams();
      if (termId) params.set('termId', termId);
      if (subjectId) params.set('subjectId', subjectId);
      const queryStr = params.toString();
      const url = queryStr ? `/api/v1/exams?${queryStr}` : '/api/v1/exams';
      const res = await api.get<ApiSuccessResponse<ExamDto[]>>(url);
      return res.data;
    },
    staleTime: 15000,
  });
}

export function useCreateExam() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<ExamDto> & { topic_ids?: string[] }) => {
      const res = await api.post<ApiSuccessResponse<ExamDto>>('/api/v1/exams', payload);
      return res.data;
    },
    onSuccess: (newExam) => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'exams'] });
      if (newExam.subject_id) {
        queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(newExam.subject_id) });
      }
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useUpdateExam() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ExamDto> & { topic_ids?: string[] } }) => {
      const res = await api.patch<ApiSuccessResponse<ExamDto>>(`/api/v1/exams/${id}`, data);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'exams'] });
      if (updated.subject_id) {
        queryClient.invalidateQueries({ queryKey: academicsKeys.subjectBundle(updated.subject_id) });
      }
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}

export function useDeleteExam() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ApiSuccessResponse<{ deleted: boolean }>>(`/api/v1/exams/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academics', 'exams'] });
      queryClient.invalidateQueries({ queryKey: academicsKeys.overview() });
    },
  });
}
