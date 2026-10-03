import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import type {
  EvidenceDto,
  EvidenceListResponse,
  CreateEvidenceInput,
  UpdateEvidenceInput,
  EvidenceQueryInput,
  ApiSuccessResponse,
} from '@avenza/shared';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const evidenceKeys = {
  all: ['evidence'] as const,
  lists: () => ['evidence', 'list'] as const,
  list: (filters: EvidenceQueryInput = {}) => [...evidenceKeys.lists(), filters] as const,
  details: () => ['evidence', 'detail'] as const,
  detail: (id: string) => [...evidenceKeys.details(), id] as const,
};

// ─── List Evidence ───────────────────────────────────────────────────────────

export function useEvidence(filters: EvidenceQueryInput = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: evidenceKeys.list(filters),
    queryFn: async (): Promise<EvidenceListResponse> => {
      const params = new URLSearchParams();
      if (filters.evidence_type) params.set('evidence_type', filters.evidence_type);
      if (filters.source_type) params.set('source_type', filters.source_type);
      if (filters.verification_status) params.set('verification_status', filters.verification_status);
      if (filters.task_id) params.set('task_id', filters.task_id);
      if (filters.goal_id) params.set('goal_id', filters.goal_id);
      if (filters.milestone_id) params.set('milestone_id', filters.milestone_id);
      if (filters.occurred_from) params.set('occurred_from', filters.occurred_from);
      if (filters.occurred_to) params.set('occurred_to', filters.occurred_to);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const queryStr = params.toString();
      const endpoint = queryStr ? `/api/v1/evidence?${queryStr}` : '/api/v1/evidence';

      const response = await api.get<EvidenceListResponse>(endpoint);
      return response;
    },
    staleTime: 10000,
  });
}

// ─── Single Evidence ──────────────────────────────────────────────────────────

export function useEvidenceItem(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: evidenceKeys.detail(id || ''),
    queryFn: async (): Promise<EvidenceDto> => {
      if (!id) throw new Error('Evidence ID is required');
      const response = await api.get<ApiSuccessResponse<EvidenceDto>>(`/api/v1/evidence/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

// ─── Create Manual Evidence ───────────────────────────────────────────────────

export function useCreateEvidence() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEvidenceInput): Promise<EvidenceDto> => {
      const response = await api.post<ApiSuccessResponse<EvidenceDto>>('/api/v1/evidence', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evidenceKeys.lists() });
    },
  });
}

// ─── Update Evidence ─────────────────────────────────────────────────────────

export function useUpdateEvidence() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateEvidenceInput;
    }): Promise<EvidenceDto> => {
      const response = await api.patch<ApiSuccessResponse<EvidenceDto>>(
        `/api/v1/evidence/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: evidenceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: evidenceKeys.detail(variables.id) });
    },
  });
}

// ─── Delete Evidence ─────────────────────────────────────────────────────────

export function useDeleteEvidence() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/api/v1/evidence/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evidenceKeys.lists() });
    },
  });
}

// ─── Record Focus Session Evidence ───────────────────────────────────────────

export function useRecordFocusSessionEvidence() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<EvidenceDto> => {
      const response = await api.post<ApiSuccessResponse<EvidenceDto>>(
        `/api/v1/evidence/from-focus-session/${sessionId}`,
        {}
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evidenceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['focus'] });
    },
  });
}
