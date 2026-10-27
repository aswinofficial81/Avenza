import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiSuccessResponse,
  CareerApplicationDetailDto,
  CareerApplicationDto,
  CareerApplicationHistoryDto,
  CareerApplicationPreparationDto,
  CareerApplicationProjectDto,
  CareerApplicationQueryInput,
  CareerInterviewDto,
  CareerInterviewQueryInput,
  CareerOpportunityDetailDto,
  CareerOpportunityDto,
  CareerOpportunityQueryInput,
  CareerTargetDetailDto,
  CareerTargetDto,
  CareerTargetQueryInput,
  CareerTargetSkillDto,
  CareerTaskReadinessItem,
  CreateCareerApplicationInput,
  CreateCareerInterviewInput,
  CreateCareerOpportunityInput,
  CreateCareerTargetInput,
  UpdateCareerApplicationInput,
  UpdateCareerInterviewInput,
  UpdateCareerOpportunityInput,
  UpdateCareerTargetInput,
  CareerApplicationStage,
} from '@avenza/shared';
import { useApiClient } from '../../../lib/api-client';

export interface TransitionCareerApplicationStageInput {
  stage: CareerApplicationStage;
  from_stage?: CareerApplicationStage;
  expected_stage?: CareerApplicationStage;
  notes?: string | null;
}

export const careerKeys = {
  all: ['career'] as const,
  targets: () => [...careerKeys.all, 'targets'] as const,
  targetList: (filters: Partial<CareerTargetQueryInput> = {}) =>
    [...careerKeys.targets(), 'list', filters] as const,
  targetDetail: (id: string) => [...careerKeys.targets(), 'detail', id] as const,
  targetSkills: (targetId: string) => [...careerKeys.targets(), 'skills', targetId] as const,

  opportunities: () => [...careerKeys.all, 'opportunities'] as const,
  opportunityList: (filters: Partial<CareerOpportunityQueryInput> = {}) =>
    [...careerKeys.opportunities(), 'list', filters] as const,
  opportunityDetail: (id: string) => [...careerKeys.opportunities(), 'detail', id] as const,
  opportunitySkills: (opportunityId: string) =>
    [...careerKeys.opportunities(), 'skills', opportunityId] as const,

  applications: () => [...careerKeys.all, 'applications'] as const,
  applicationList: (filters: Partial<CareerApplicationQueryInput> = {}) =>
    [...careerKeys.applications(), 'list', filters] as const,
  applicationDetail: (id: string) => [...careerKeys.applications(), 'detail', id] as const,
  applicationHistory: (id: string) => [...careerKeys.applications(), 'history', id] as const,
  applicationPreparation: (id: string) =>
    [...careerKeys.applications(), 'preparation', id] as const,
  applicationTasks: (id: string) => [...careerKeys.applications(), 'tasks', id] as const,
  applicationProjects: (applicationId: string) =>
    [...careerKeys.applications(), 'projects', applicationId] as const,

  interviews: () => [...careerKeys.all, 'interviews'] as const,
  interviewList: (filters: Partial<CareerInterviewQueryInput> = {}) =>
    [...careerKeys.interviews(), 'list', filters] as const,
  interviewDetail: (id: string) => [...careerKeys.interviews(), 'detail', id] as const,
};

export interface CareerListResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ==============================================================================
// 1. Career Targets Hooks
// ==============================================================================

export function useCareerTargets(filters: Partial<CareerTargetQueryInput> = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.targetList(filters),
    queryFn: async (): Promise<CareerListResponse<CareerTargetDto>> => {
      const searchParams = new URLSearchParams();
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.is_primary !== undefined) searchParams.set('is_primary', String(filters.is_primary));
      if (filters.employment_type) searchParams.set('employment_type', filters.employment_type);
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);
      if (filters.page) searchParams.set('page', String(filters.page));
      if (filters.pageSize) searchParams.set('pageSize', String(filters.pageSize));

      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/v1/career/targets?${queryStr}` : '/api/v1/career/targets';
      const response = await api.get<{
        success: boolean;
        data: CareerTargetDto[];
        pagination: CareerListResponse<CareerTargetDto>['pagination'];
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

export function useCareerTarget(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.targetDetail(id || ''),
    queryFn: async (): Promise<CareerTargetDetailDto> => {
      if (!id) throw new Error('Target ID is required');
      const response = await api.get<ApiSuccessResponse<CareerTargetDetailDto>>(
        `/api/v1/career/targets/${id}`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateCareerTarget() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCareerTargetInput): Promise<CareerTargetDto> => {
      const response = await api.post<ApiSuccessResponse<CareerTargetDto>>(
        '/api/v1/career/targets',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.targets() });
    },
  });
}

export function useUpdateCareerTarget(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCareerTargetInput): Promise<CareerTargetDto> => {
      const response = await api.patch<ApiSuccessResponse<CareerTargetDto>>(
        `/api/v1/career/targets/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.targetDetail(id) });
      queryClient.invalidateQueries({ queryKey: careerKeys.targets() });
    },
  });
}

export function useDeleteCareerTarget() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/api/v1/career/targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.targets() });
    },
  });
}

export function useSetPrimaryCareerTarget() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<CareerTargetDto> => {
      const response = await api.post<ApiSuccessResponse<CareerTargetDto>>(
        `/api/v1/career/targets/${id}/primary`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.targets() });
    },
  });
}

export function useCareerTargetSkills(targetId: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.targetSkills(targetId || ''),
    queryFn: async (): Promise<CareerTargetSkillDto[]> => {
      if (!targetId) return [];
      const response = await api.get<ApiSuccessResponse<CareerTargetSkillDto[]>>(
        `/api/v1/career/targets/${targetId}/skills`
      );
      return response.data || [];
    },
    enabled: Boolean(targetId),
  });
}

export function useAddCareerTargetSkill(targetId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { skill_id: string; importance?: string }): Promise<CareerTargetSkillDto> => {
      const response = await api.post<ApiSuccessResponse<CareerTargetSkillDto>>(
        `/api/v1/career/targets/${targetId}/skills`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.targetSkills(targetId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.targetDetail(targetId) });
    },
  });
}

export function useRemoveCareerTargetSkill(targetId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (skillId: string): Promise<void> => {
      await api.delete(`/api/v1/career/targets/${targetId}/skills/${skillId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.targetSkills(targetId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.targetDetail(targetId) });
    },
  });
}

// ==============================================================================
// 2. Career Opportunities Hooks
// ==============================================================================

export function useCareerOpportunities(filters: Partial<CareerOpportunityQueryInput> = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.opportunityList(filters),
    queryFn: async (): Promise<CareerListResponse<CareerOpportunityDto>> => {
      const searchParams = new URLSearchParams();
      if (filters.target_id) searchParams.set('target_id', filters.target_id);
      if (filters.status) searchParams.set('status', filters.status);
      if (filters.employment_type) searchParams.set('employment_type', filters.employment_type);
      if (filters.location_type) searchParams.set('location_type', filters.location_type);
      if (filters.source) searchParams.set('source', filters.source);
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);
      if (filters.page) searchParams.set('page', String(filters.page));
      if (filters.pageSize) searchParams.set('pageSize', String(filters.pageSize));

      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/v1/career/opportunities?${queryStr}` : '/api/v1/career/opportunities';
      const response = await api.get<{
        success: boolean;
        data: CareerOpportunityDto[];
        pagination: CareerListResponse<CareerOpportunityDto>['pagination'];
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

export function useCareerOpportunity(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.opportunityDetail(id || ''),
    queryFn: async (): Promise<CareerOpportunityDetailDto> => {
      if (!id) throw new Error('Opportunity ID is required');
      const response = await api.get<ApiSuccessResponse<CareerOpportunityDetailDto>>(
        `/api/v1/career/opportunities/${id}`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateCareerOpportunity() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCareerOpportunityInput): Promise<CareerOpportunityDto> => {
      const response = await api.post<ApiSuccessResponse<CareerOpportunityDto>>(
        '/api/v1/career/opportunities',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.opportunities() });
    },
  });
}

export function useUpdateCareerOpportunity(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCareerOpportunityInput): Promise<CareerOpportunityDto> => {
      const response = await api.patch<ApiSuccessResponse<CareerOpportunityDto>>(
        `/api/v1/career/opportunities/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.opportunityDetail(id) });
      queryClient.invalidateQueries({ queryKey: careerKeys.opportunities() });
    },
  });
}

export function useDeleteCareerOpportunity() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/api/v1/career/opportunities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.opportunities() });
    },
  });
}

// ==============================================================================
// 3. Career Applications & Stage Transitions
// ==============================================================================

export function useCareerApplications(filters: Partial<CareerApplicationQueryInput> = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.applicationList(filters),
    queryFn: async (): Promise<CareerListResponse<CareerApplicationDto>> => {
      const searchParams = new URLSearchParams();
      if (filters.stage) searchParams.set('stage', filters.stage);
      if (filters.opportunity_id) searchParams.set('opportunity_id', filters.opportunity_id);
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);
      if (filters.page) searchParams.set('page', String(filters.page));
      if (filters.pageSize) searchParams.set('pageSize', String(filters.pageSize));

      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/v1/career/applications?${queryStr}` : '/api/v1/career/applications';
      const response = await api.get<{
        success: boolean;
        data: CareerApplicationDto[];
        pagination: CareerListResponse<CareerApplicationDto>['pagination'];
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

export function useCareerApplication(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.applicationDetail(id || ''),
    queryFn: async (): Promise<CareerApplicationDetailDto> => {
      if (!id) throw new Error('Application ID is required');
      const response = await api.get<ApiSuccessResponse<CareerApplicationDetailDto>>(
        `/api/v1/career/applications/${id}`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateCareerApplication() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCareerApplicationInput): Promise<CareerApplicationDto> => {
      const response = await api.post<ApiSuccessResponse<CareerApplicationDto>>(
        '/api/v1/career/applications',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
      queryClient.invalidateQueries({ queryKey: careerKeys.opportunities() });
    },
  });
}

export function useUpdateCareerApplication(id: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCareerApplicationInput): Promise<CareerApplicationDto> => {
      const response = await api.patch<ApiSuccessResponse<CareerApplicationDto>>(
        `/api/v1/career/applications/${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(id) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
    },
  });
}

export function useDeleteCareerApplication() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/api/v1/career/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
    },
  });
}

export function useCareerApplicationHistory(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.applicationHistory(id || ''),
    queryFn: async (): Promise<CareerApplicationHistoryDto[]> => {
      if (!id) return [];
      const response = await api.get<ApiSuccessResponse<CareerApplicationHistoryDto[]>>(
        `/api/v1/career/applications/${id}/history`
      );
      return response.data || [];
    },
    enabled: Boolean(id),
  });
}

/**
 * Handles stage transitions with robust HTTP 409 conflict mitigation.
 * Never optimistically commits state before server confirmation.
 * Refetches application detail, history, and pipeline on conflict.
 */
export function useTransitionCareerApplicationStage(applicationId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TransitionCareerApplicationStageInput): Promise<CareerApplicationDto> => {
      const response = await api.post<ApiSuccessResponse<CareerApplicationDto>>(
        `/api/v1/career/applications/${applicationId}/stage`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationHistory(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
    },
    onError: () => {
      // In case of conflict (409) or transition rejection, refetch real server state immediately
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationHistory(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applications() });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
    },
  });
}

export function useCareerApplicationPreparation(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.applicationPreparation(id || ''),
    queryFn: async (): Promise<CareerApplicationPreparationDto> => {
      if (!id) throw new Error('Application ID is required');
      const response = await api.get<ApiSuccessResponse<CareerApplicationPreparationDto>>(
        `/api/v1/career/applications/${id}/preparation`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useCareerApplicationTasks(id: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.applicationTasks(id || ''),
    queryFn: async (): Promise<CareerTaskReadinessItem[]> => {
      if (!id) return [];
      const response = await api.get<ApiSuccessResponse<CareerTaskReadinessItem[]>>(
        `/api/v1/career/applications/${id}/tasks`
      );
      return response.data || [];
    },
    enabled: Boolean(id),
  });
}

// ==============================================================================
// 4. Career Application Projects Hooks
// ==============================================================================

export function useCareerApplicationProjects(applicationId: string | undefined) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.applicationProjects(applicationId || ''),
    queryFn: async (): Promise<CareerApplicationProjectDto[]> => {
      if (!applicationId) return [];
      const response = await api.get<ApiSuccessResponse<CareerApplicationProjectDto[]>>(
        `/api/v1/career/applications/${applicationId}/projects`
      );
      return response.data || [];
    },
    enabled: Boolean(applicationId),
  });
}

export function useAttachCareerApplicationProject(applicationId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { project_id: string; is_featured?: boolean; talking_points?: string | null }) => {
      const response = await api.post<ApiSuccessResponse<CareerApplicationProjectDto>>(
        `/api/v1/career/applications/${applicationId}/projects`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationProjects(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
    },
  });
}

export function useUpdateCareerApplicationProject(applicationId: string, projectId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { is_featured?: boolean; talking_points?: string | null }) => {
      const response = await api.patch<ApiSuccessResponse<CareerApplicationProjectDto>>(
        `/api/v1/career/applications/${applicationId}/projects/${projectId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationProjects(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
    },
  });
}

export function useRemoveCareerApplicationProject(applicationId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await api.delete(`/api/v1/career/applications/${applicationId}/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationProjects(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
    },
  });
}

// ==============================================================================
// 5. Career Interviews Hooks
// ==============================================================================

export function useCareerInterviews(filters: Partial<CareerInterviewQueryInput> = {}) {
  const api = useApiClient();

  return useQuery({
    queryKey: careerKeys.interviewList(filters),
    queryFn: async (): Promise<CareerListResponse<CareerInterviewDto>> => {
      const searchParams = new URLSearchParams();
      if (filters.application_id) searchParams.set('application_id', filters.application_id);
      if (filters.status) searchParams.set('status', filters.status);
      if (filters.result) searchParams.set('result', filters.result);
      if (filters.round_type) searchParams.set('round_type', filters.round_type);
      if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
      if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);
      if (filters.page) searchParams.set('page', String(filters.page));
      if (filters.pageSize) searchParams.set('pageSize', String(filters.pageSize));

      const queryStr = searchParams.toString();
      const endpoint = queryStr ? `/api/v1/career/interviews?${queryStr}` : '/api/v1/career/interviews';
      const response = await api.get<{
        success: boolean;
        data: CareerInterviewDto[];
        pagination: CareerListResponse<CareerInterviewDto>['pagination'];
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

export function useCreateCareerInterview(applicationId: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCareerInterviewInput): Promise<CareerInterviewDto> => {
      const response = await api.post<ApiSuccessResponse<CareerInterviewDto>>(
        `/api/v1/career/applications/${applicationId}/interviews`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.interviews() });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
      queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
    },
  });
}

export function useUpdateCareerInterview(interviewId: string, applicationId?: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCareerInterviewInput): Promise<CareerInterviewDto> => {
      const response = await api.patch<ApiSuccessResponse<CareerInterviewDto>>(
        `/api/v1/career/interviews/${interviewId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.interviews() });
      if (applicationId) {
        queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
        queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
      }
    },
  });
}

export function useDeleteCareerInterview(applicationId?: string) {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interviewId: string): Promise<void> => {
      await api.delete(`/api/v1/career/interviews/${interviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: careerKeys.interviews() });
      if (applicationId) {
        queryClient.invalidateQueries({ queryKey: careerKeys.applicationDetail(applicationId) });
        queryClient.invalidateQueries({ queryKey: careerKeys.applicationPreparation(applicationId) });
      }
    },
  });
}
