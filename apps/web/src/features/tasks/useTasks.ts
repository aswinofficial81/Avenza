import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import type {
  TaskDto,
  TaskDetailDto,
  TaskDependencyDto,
  PaginatedList,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTaskDependencyInput,
  TaskQueryInput,
  ApiSuccessResponse,
} from '@avenza/shared';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskQueryInput = {}) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  dependencies: (taskId: string) => [...taskKeys.detail(taskId), 'dependencies'] as const,
};

export function useTasks(filters: TaskQueryInput = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.status) searchParams.set('status', filters.status);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.task_type) searchParams.set('task_type', filters.task_type);
      if (filters.goal_id) searchParams.set('goal_id', filters.goal_id);
      if (filters.milestone_id) searchParams.set('milestone_id', filters.milestone_id);
      if (filters.blocked !== undefined) searchParams.set('blocked', String(filters.blocked));
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.due_before) searchParams.set('due_before', filters.due_before);
      if (filters.due_after) searchParams.set('due_after', filters.due_after);
      if (filters.scheduled_before) searchParams.set('scheduled_before', filters.scheduled_before);
      if (filters.scheduled_after) searchParams.set('scheduled_after', filters.scheduled_after);
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);
      if (filters.page) searchParams.set('page', String(filters.page));
      if (filters.pageSize) searchParams.set('pageSize', String(filters.pageSize));

      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/v1/tasks?${queryStr}` : '/api/v1/tasks';

      const response = await api.get<PaginatedList<TaskDto>>(endpoint);
      return response;
    },
  });
}

export function useTask(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: taskKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Task ID is required');
      const response = await api.get<ApiSuccessResponse<TaskDetailDto>>(`/api/v1/tasks/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      const response = await api.post<ApiSuccessResponse<TaskDetailDto>>('/api/v1/tasks', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useUpdateTask(taskId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateTaskInput) => {
      const response = await api.patch<ApiSuccessResponse<TaskDetailDto>>(
        `/api/v1/tasks/${taskId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useDeleteTask() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `/api/v1/tasks/${taskId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useTaskDependencies(taskId: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: taskKeys.dependencies(taskId || ''),
    queryFn: async () => {
      if (!taskId) return [];
      const response = await api.get<ApiSuccessResponse<TaskDependencyDto[]>>(
        `/api/v1/tasks/${taskId}/dependencies`
      );
      return response.data;
    },
    enabled: Boolean(taskId),
  });
}

export function useCreateTaskDependency(taskId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTaskDependencyInput) => {
      const response = await api.post<ApiSuccessResponse<TaskDependencyDto>>(
        `/api/v1/tasks/${taskId}/dependencies`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dependencies(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useDeleteTaskDependency(taskId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dependencyId: string) => {
      const response = await api.delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `/api/v1/tasks/${taskId}/dependencies/${dependencyId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dependencies(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
