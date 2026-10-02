import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import type {
  GoalDto,
  GoalDetailDto,
  MilestoneDto,
  PaginatedList,
  CreateGoalInput,
  UpdateGoalInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  GoalQueryInput,
  ApiSuccessResponse,
} from '@avenza/shared';

export const goalKeys = {
  all: ['goals'] as const,
  lists: () => [...goalKeys.all, 'list'] as const,
  list: (filters: GoalQueryInput = {}) => [...goalKeys.lists(), filters] as const,
  details: () => [...goalKeys.all, 'detail'] as const,
  detail: (id: string) => [...goalKeys.details(), id] as const,
  milestones: (goalId: string) => [...goalKeys.detail(goalId), 'milestones'] as const,
};

export function useGoals(filters: GoalQueryInput = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: goalKeys.list(filters),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.status) searchParams.set('status', filters.status);
      if (filters.goal_type) searchParams.set('goal_type', filters.goal_type);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.health) searchParams.set('health', filters.health);
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);
      if (filters.page) searchParams.set('page', String(filters.page));
      if (filters.pageSize) searchParams.set('pageSize', String(filters.pageSize));

      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/v1/goals?${queryStr}` : '/api/v1/goals';

      const response = await api.get<PaginatedList<GoalDto>>(endpoint);
      return response;
    },
  });
}

export function useGoal(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: goalKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Goal ID is required');
      const response = await api.get<ApiSuccessResponse<GoalDetailDto>>(`/api/v1/goals/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateGoal() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGoalInput) => {
      const response = await api.post<ApiSuccessResponse<GoalDto>>('/api/v1/goals', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useUpdateGoal(goalId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateGoalInput) => {
      const response = await api.patch<ApiSuccessResponse<GoalDetailDto>>(`/api/v1/goals/${goalId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useDeleteGoal() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string) => {
      await api.delete(`/api/v1/goals/${goalId}`);
      return goalId;
    },
    onSuccess: (deletedId) => {
      queryClient.removeQueries({ queryKey: goalKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useCreateMilestone(goalId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMilestoneInput) => {
      const response = await api.post<ApiSuccessResponse<MilestoneDto>>(
        `/api/v1/goals/${goalId}/milestones`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useUpdateMilestone(goalId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      milestoneId,
      data,
    }: {
      milestoneId: string;
      data: UpdateMilestoneInput;
    }) => {
      const response = await api.patch<ApiSuccessResponse<MilestoneDto>>(
        `/api/v1/goals/${goalId}/milestones/${milestoneId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useDeleteMilestone(goalId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (milestoneId: string) => {
      await api.delete(`/api/v1/goals/${goalId}/milestones/${milestoneId}`);
      return milestoneId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}
