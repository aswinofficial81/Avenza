import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import type {
  ApiSuccessResponse,
  CreateSkillInput,
  EvidenceSkillDto,
  GoalSkillDto,
  LinkEvidenceToSkillInput,
  LinkGoalToSkillInput,
  LinkTaskToSkillInput,
  LinkTopicToSkillInput,
  SkillDetailDto,
  SkillDto,
  SkillMasteryDto,
  SkillQueryInput,
  SkillWithMasteryDto,
  TaskSkillDto,
  TopicSkillDto,
  UpdateSkillInput,
} from '@avenza/shared';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const skillsKeys = {
  all: ['skills'] as const,
  lists: () => ['skills', 'list'] as const,
  list: (filters: SkillQueryInput = {}) => [...skillsKeys.lists(), filters] as const,
  details: () => ['skills', 'detail'] as const,
  detail: (id: string) => [...skillsKeys.details(), id] as const,
  masteries: () => ['skills', 'mastery'] as const,
  mastery: (id: string) => [...skillsKeys.masteries(), id] as const,
};

// ─── Query Hooks ────────────────────────────────────────────────────────────

export function useSkills(filters: SkillQueryInput = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: skillsKeys.list(filters),
    queryFn: async (): Promise<SkillWithMasteryDto[]> => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.category) params.set('category', filters.category);
      if (filters.parent_skill_id !== undefined && filters.parent_skill_id !== null) {
        params.set('parent_skill_id', filters.parent_skill_id);
      }
      if (filters.search) params.set('search', filters.search);

      const queryStr = params.toString();
      const endpoint = queryStr ? `/api/v1/skills?${queryStr}` : '/api/v1/skills';

      const response = await api.get<ApiSuccessResponse<SkillWithMasteryDto[]>>(endpoint);
      return response.data;
    },
    staleTime: 10000,
  });
}

export function useSkill(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: skillsKeys.detail(id || ''),
    queryFn: async (): Promise<SkillWithMasteryDto> => {
      if (!id) throw new Error('Skill ID is required');
      const response = await api.get<ApiSuccessResponse<SkillWithMasteryDto>>(
        `/api/v1/skills/${id}`
      );
      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 10000,
  });
}

export function useSkillDetail(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: [...skillsKeys.detail(id || ''), 'full'],
    queryFn: async (): Promise<SkillDetailDto> => {
      if (!id) throw new Error('Skill ID is required');
      const response = await api.get<ApiSuccessResponse<SkillDetailDto>>(
        `/api/v1/skills/${id}/detail`
      );
      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 10000,
  });
}

export function useSkillMastery(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: skillsKeys.mastery(id || ''),
    queryFn: async (): Promise<SkillMasteryDto> => {
      if (!id) throw new Error('Skill ID is required');
      const response = await api.get<ApiSuccessResponse<SkillMasteryDto>>(
        `/api/v1/skills/${id}/mastery`
      );
      return response.data;
    },
    enabled: Boolean(id),
    staleTime: 10000,
  });
}

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

export function useCreateSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSkillInput): Promise<SkillDto> => {
      const response = await api.post<ApiSuccessResponse<SkillDto>>('/api/v1/skills', input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.all });
    },
  });
}

export function useUpdateSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSkillInput }): Promise<SkillDto> => {
      const response = await api.patch<ApiSuccessResponse<SkillDto>>(`/api/v1/skills/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: skillsKeys.lists() });
    },
  });
}

export function useArchiveSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<SkillDto> => {
      const response = await api.post<ApiSuccessResponse<SkillDto>>(
        `/api/v1/skills/${id}/archive`,
        {}
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.all });
    },
  });
}

export function useDeleteSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/api/v1/skills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.all });
    },
  });
}

export function useLinkEvidenceToSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LinkEvidenceToSkillInput): Promise<EvidenceSkillDto> => {
      const response = await api.post<ApiSuccessResponse<EvidenceSkillDto>>(
        `/api/v1/skills/${input.skill_id}/evidence`,
        { evidence_id: input.evidence_id }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skill_id) });
      queryClient.invalidateQueries({ queryKey: skillsKeys.lists() });
    },
  });
}

export function useUnlinkEvidenceFromSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillId, evidenceId }: { skillId: string; evidenceId: string }): Promise<void> => {
      await api.delete(`/api/v1/skills/${skillId}/evidence/${evidenceId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillId) });
      queryClient.invalidateQueries({ queryKey: skillsKeys.lists() });
    },
  });
}

export function useLinkGoalToSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LinkGoalToSkillInput): Promise<GoalSkillDto> => {
      const response = await api.post<ApiSuccessResponse<GoalSkillDto>>(
        `/api/v1/skills/${input.skill_id}/goals`,
        {
          goal_id: input.goal_id,
          target_mastery_state: input.target_mastery_state,
        }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skill_id) });
    },
  });
}

export function useUnlinkGoalFromSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillId, goalId }: { skillId: string; goalId: string }): Promise<void> => {
      await api.delete(`/api/v1/skills/${skillId}/goals/${goalId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillId) });
    },
  });
}

export function useLinkTaskToSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LinkTaskToSkillInput): Promise<TaskSkillDto> => {
      const response = await api.post<ApiSuccessResponse<TaskSkillDto>>(
        `/api/v1/skills/${input.skill_id}/tasks`,
        { task_id: input.task_id }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skill_id) });
    },
  });
}

export function useUnlinkTaskFromSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillId, taskId }: { skillId: string; taskId: string }): Promise<void> => {
      await api.delete(`/api/v1/skills/${skillId}/tasks/${taskId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillId) });
    },
  });
}

export function useLinkTopicToSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LinkTopicToSkillInput): Promise<TopicSkillDto> => {
      const response = await api.post<ApiSuccessResponse<TopicSkillDto>>(
        `/api/v1/skills/${input.skill_id}/topics`,
        { topic_id: input.topic_id }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skill_id) });
    },
  });
}

export function useUnlinkTopicFromSkill() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillId, topicId }: { skillId: string; topicId: string }): Promise<void> => {
      await api.delete(`/api/v1/skills/${skillId}/topics/${topicId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillId) });
    },
  });
}
