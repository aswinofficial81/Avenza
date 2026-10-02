import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import type {
  FocusSessionDto,
  CreateFocusSessionInput,
  CompleteFocusSessionInput,
  CancelFocusSessionInput,
  FocusSessionsQueryInput,
  PaginatedList,
  ApiSuccessResponse,
} from '@avenza/shared';

export const focusKeys = {
  all: ['focus'] as const,
  active: () => ['focus', 'active'] as const,
  lists: () => ['focus', 'sessions'] as const,
  list: (filters: FocusSessionsQueryInput = {}) => [...focusKeys.lists(), filters] as const,
  details: () => ['focus', 'session'] as const,
  detail: (id: string) => [...focusKeys.details(), id] as const,
};

export function useActiveFocusSession() {
  const api = useApiClient();

  return useQuery({
    queryKey: focusKeys.active(),
    queryFn: async (): Promise<FocusSessionDto | null> => {
      const response = await api.get<ApiSuccessResponse<FocusSessionDto | null>>(
        '/api/v1/focus-sessions/active'
      );
      return response.data;
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useFocusSessions(filters: FocusSessionsQueryInput = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: focusKeys.list(filters),
    queryFn: async (): Promise<PaginatedList<FocusSessionDto>> => {
      const params = new URLSearchParams();
      if (filters.taskId) params.set('taskId', filters.taskId);
      if (filters.status) params.set('status', filters.status);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const queryStr = params.toString();
      const endpoint = queryStr ? `/api/v1/focus-sessions?${queryStr}` : '/api/v1/focus-sessions';

      const response = await api.get<PaginatedList<FocusSessionDto>>(endpoint);
      return response;
    },
    staleTime: 10000,
  });
}

export function useFocusSession(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: focusKeys.detail(id || ''),
    queryFn: async (): Promise<FocusSessionDto> => {
      if (!id) throw new Error('Focus session ID is required');
      const response = await api.get<ApiSuccessResponse<FocusSessionDto>>(
        `/api/v1/focus-sessions/${id}`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useStartFocusSession() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFocusSessionInput): Promise<FocusSessionDto> => {
      const response = await api.post<ApiSuccessResponse<FocusSessionDto>>(
        '/api/v1/focus-sessions',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: focusKeys.active() });
      queryClient.invalidateQueries({ queryKey: focusKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCompleteFocusSession() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes?: string | null;
    }): Promise<FocusSessionDto> => {
      const payload: CompleteFocusSessionInput = { notes: notes || null };
      const response = await api.post<ApiSuccessResponse<FocusSessionDto>>(
        `/api/v1/focus-sessions/${id}/complete`,
        payload
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: focusKeys.active() });
      queryClient.invalidateQueries({ queryKey: focusKeys.lists() });
      queryClient.invalidateQueries({ queryKey: focusKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCancelFocusSession() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes?: string | null;
    }): Promise<FocusSessionDto> => {
      const payload: CancelFocusSessionInput = { notes: notes || null };
      const response = await api.post<ApiSuccessResponse<FocusSessionDto>>(
        `/api/v1/focus-sessions/${id}/cancel`,
        payload
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: focusKeys.active() });
      queryClient.invalidateQueries({ queryKey: focusKeys.lists() });
      queryClient.invalidateQueries({ queryKey: focusKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
