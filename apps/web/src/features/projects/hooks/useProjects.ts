import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiSuccessResponse,
  CreateProjectInput,
  CreateProjectMilestoneInput,
  ExternalActivityDto,
  ProjectDetailDto,
  ProjectDto,
  ProjectGoalDto,
  ProjectMilestoneDto,
  ProjectQueryInput,
  ProjectSkillDto,
  ProjectSkillRole,
  TaskDto,
  TaskStatus,
  UpdateProjectInput,
  UpdateProjectMilestoneInput,
} from '@avenza/shared';
import { useApiClient } from '../../../lib/api-client';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: Partial<ProjectQueryInput> = {}) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  goals: (id: string) => [...projectKeys.detail(id), 'goals'] as const,
  skills: (id: string) => [...projectKeys.detail(id), 'skills'] as const,
  activities: (id: string) => [...projectKeys.detail(id), 'activities'] as const,
  milestones: (id: string) => [...projectKeys.detail(id), 'milestones'] as const,
  tasks: (id: string, filters?: { status?: TaskStatus; milestone_id?: string }) =>
    [...projectKeys.detail(id), 'tasks', filters] as const,
};

export interface ProjectsListResponse {
  data: ProjectDto[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export function useProjects(filters: Partial<ProjectQueryInput> = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: async (): Promise<ProjectsListResponse> => {
      const searchParams = new URLSearchParams();
      if (filters.status) searchParams.set('status', filters.status);
      if (filters.priority) searchParams.set('priority', filters.priority);
      if (filters.project_type) searchParams.set('project_type', filters.project_type);
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.page) searchParams.set('page', String(filters.page));
      if (filters.pageSize) searchParams.set('pageSize', String(filters.pageSize));
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);

      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/v1/projects?${queryStr}` : '/api/v1/projects';

      const response = await api.get<{
        success: boolean;
        data: ProjectDto[];
        pagination: ProjectsListResponse['pagination'];
      }>(endpoint);

      return {
        data: response.data || [],
        pagination: response.pagination || {
          total: response.data?.length || 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      };
    },
  });
}

export function useProject(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: projectKeys.detail(id || ''),
    queryFn: async (): Promise<ProjectDetailDto> => {
      if (!id) throw new Error('Project ID is required');
      const response = await api.get<ApiSuccessResponse<ProjectDetailDto>>(
        `/api/v1/projects/${id}`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<ProjectDto> => {
      const response = await api.post<ApiSuccessResponse<ProjectDto>>(
        '/api/v1/projects',
        input
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProjectInput): Promise<ProjectDto> => {
      const response = await api.patch<ApiSuccessResponse<ProjectDto>>(
        `/api/v1/projects/${id}`,
        input
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ deleted: boolean }> => {
      const response = await api.delete<ApiSuccessResponse<{ deleted: boolean }>>(
        `/api/v1/projects/${id}`
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useProjectMilestones(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: projectKeys.milestones(id || ''),
    queryFn: async (): Promise<ProjectMilestoneDto[]> => {
      if (!id) throw new Error('Project ID is required');
      const response = await api.get<ApiSuccessResponse<ProjectMilestoneDto[]>>(
        `/api/v1/projects/${id}/milestones`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateProjectMilestone(projectId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectMilestoneInput): Promise<ProjectMilestoneDto> => {
      const response = await api.post<ApiSuccessResponse<ProjectMilestoneDto>>(
        `/api/v1/projects/${projectId}/milestones`,
        input
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProjectMilestone(projectId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateProjectMilestoneInput;
    }): Promise<ProjectMilestoneDto> => {
      const response = await api.patch<ApiSuccessResponse<ProjectMilestoneDto>>(
        `/api/v1/projects/${projectId}/milestones/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProjectMilestone(projectId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<{ deleted: boolean }> => {
      const response = await api.delete<ApiSuccessResponse<{ deleted: boolean }>>(
        `/api/v1/projects/${projectId}/milestones/${id}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useProjectTasks(
  projectId: string | undefined,
  filters?: { status?: TaskStatus; milestone_id?: string }
) {
  const api = useApiClient();

  return useQuery({
    queryKey: projectKeys.tasks(projectId || '', filters),
    queryFn: async (): Promise<TaskDto[]> => {
      if (!projectId) throw new Error('Project ID is required');
      const searchParams = new URLSearchParams();
      if (filters?.status) searchParams.set('status', filters.status);
      if (filters?.milestone_id) searchParams.set('milestone_id', filters.milestone_id);
      const queryStr = searchParams.toString();
      const endpoint = queryStr
        ? `/api/v1/projects/${projectId}/tasks?${queryStr}`
        : `/api/v1/projects/${projectId}/tasks`;
      const response = await api.get<ApiSuccessResponse<TaskDto[]>>(endpoint);
      return response.data;
    },
    enabled: Boolean(projectId),
  });
}

export function useProjectGoals(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: projectKeys.goals(id || ''),
    queryFn: async (): Promise<ProjectGoalDto[]> => {
      if (!id) throw new Error('Project ID is required');
      const response = await api.get<ApiSuccessResponse<ProjectGoalDto[]>>(
        `/api/v1/projects/${id}/goals`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useProjectSkills(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: projectKeys.skills(id || ''),
    queryFn: async (): Promise<ProjectSkillDto[]> => {
      if (!id) throw new Error('Project ID is required');
      const response = await api.get<ApiSuccessResponse<ProjectSkillDto[]>>(
        `/api/v1/projects/${id}/skills`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useProjectActivities(id: string | undefined, limit = 20) {
  const api = useApiClient();

  return useQuery({
    queryKey: [...projectKeys.activities(id || ''), { limit }],
    queryFn: async (): Promise<ExternalActivityDto[]> => {
      if (!id) throw new Error('Project ID is required');
      const response = await api.get<ApiSuccessResponse<ExternalActivityDto[]>>(
        `/api/v1/projects/${id}/activities?limit=${limit}`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useAttachProjectGoal() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      goalId,
      isPrimary = false,
    }: {
      projectId: string;
      goalId: string;
      isPrimary?: boolean;
    }): Promise<ProjectGoalDto> => {
      const response = await api.post<ApiSuccessResponse<ProjectGoalDto>>(
        `/api/v1/projects/${projectId}/goals`,
        { goal_id: goalId, is_primary: isPrimary }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.goals(variables.projectId) });
    },
  });
}

export function useUpdateProjectGoal() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      goalId,
      isPrimary,
    }: {
      projectId: string;
      goalId: string;
      isPrimary: boolean;
    }): Promise<ProjectGoalDto> => {
      const response = await api.patch<ApiSuccessResponse<ProjectGoalDto>>(
        `/api/v1/projects/${projectId}/goals/${goalId}`,
        { is_primary: isPrimary }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.goals(variables.projectId) });
    },
  });
}

export function useDetachProjectGoal() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      goalId,
    }: {
      projectId: string;
      goalId: string;
    }): Promise<{ unlinked: boolean }> => {
      const response = await api.delete<ApiSuccessResponse<{ unlinked: boolean }>>(
        `/api/v1/projects/${projectId}/goals/${goalId}`
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.goals(variables.projectId) });
    },
  });
}

export function useAttachProjectSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      skillId,
      role = 'primary',
    }: {
      projectId: string;
      skillId: string;
      role?: ProjectSkillRole;
    }): Promise<ProjectSkillDto> => {
      const response = await api.post<ApiSuccessResponse<ProjectSkillDto>>(
        `/api/v1/projects/${projectId}/skills`,
        { skill_id: skillId, role }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.skills(variables.projectId) });
    },
  });
}

export function useUpdateProjectSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      skillId,
      role,
    }: {
      projectId: string;
      skillId: string;
      role: ProjectSkillRole;
    }): Promise<ProjectSkillDto> => {
      const response = await api.patch<ApiSuccessResponse<ProjectSkillDto>>(
        `/api/v1/projects/${projectId}/skills/${skillId}`,
        { role }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.skills(variables.projectId) });
    },
  });
}

export function useDetachProjectSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      skillId,
    }: {
      projectId: string;
      skillId: string;
    }): Promise<{ unlinked: boolean }> => {
      const response = await api.delete<ApiSuccessResponse<{ unlinked: boolean }>>(
        `/api/v1/projects/${projectId}/skills/${skillId}`
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.skills(variables.projectId) });
    },
  });
}

export function useLinkProjectRepository() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      repositoryId,
    }: {
      projectId: string;
      repositoryId: string | null;
    }): Promise<ProjectDto> => {
      const response = await api.post<ApiSuccessResponse<ProjectDto>>(
        `/api/v1/projects/${projectId}/link-repository`,
        { repository_id: repositoryId }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.activities(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
