import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiSuccessResponse,
  ExternalActivityDto,
  ExternalCalendarEventDto,
  ExternalRepositoryDto,
  IntegrationConnectionDto,
  IntegrationProvider,
  IntegrationStatusResponseDto,
  IntegrationSyncResponseDto,
  OAuthInitResponseDto,
} from '@avenza/shared';
import { useApiClient } from '../../../lib/api-client';

export const integrationKeys = {
  all: ['integrations'] as const,
  status: (provider: IntegrationProvider) => [...integrationKeys.all, 'status', provider] as const,
  repositories: (provider: IntegrationProvider) => [...integrationKeys.all, 'repositories', provider] as const,
  activities: (provider: IntegrationProvider) => [...integrationKeys.all, 'activities', provider] as const,
  events: (provider: IntegrationProvider) => [...integrationKeys.all, 'events', provider] as const,
};

export function useIntegrationStatus(provider: IntegrationProvider = 'github') {
  const api = useApiClient();

  return useQuery({
    queryKey: integrationKeys.status(provider),
    queryFn: async (): Promise<IntegrationStatusResponseDto> => {
      const response = await api.get<ApiSuccessResponse<IntegrationStatusResponseDto>>(
        `/api/v1/integrations/${provider}/status`
      );
      return response.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.connection?.status;
      return status === 'SYNCING' ? 3000 : false;
    },
  });
}

export function useConnectIntegration() {
  const api = useApiClient();

  return useMutation({
    mutationFn: async ({
      provider = 'github',
      redirectUrl,
    }: {
      provider?: IntegrationProvider;
      redirectUrl?: string;
    }): Promise<OAuthInitResponseDto> => {
      const response = await api.post<ApiSuccessResponse<OAuthInitResponseDto>>(
        `/api/v1/integrations/${provider}/connect`,
        { redirect_url: redirectUrl }
      );
      return response.data;
    },
  });
}

export function useConnectDirectIntegration() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider = 'leetcode',
      username,
      handle,
    }: {
      provider?: IntegrationProvider;
      username?: string;
      handle?: string;
    }): Promise<IntegrationConnectionDto> => {
      const payload: Record<string, string> = {};
      if (username) payload.username = username;
      if (handle) payload.handle = handle;
      const response = await api.post<ApiSuccessResponse<IntegrationConnectionDto>>(
        `/api/v1/integrations/${provider}/connect`,
        payload
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      const prov = variables.provider || 'leetcode';
      queryClient.invalidateQueries({ queryKey: integrationKeys.status(prov) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.activities(prov) });
    },
  });
}

export function useProcessOAuthCallback() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider = 'github',
      code,
      state,
    }: {
      provider?: IntegrationProvider;
      code: string;
      state: string;
    }): Promise<IntegrationConnectionDto> => {
      const response = await api.get<ApiSuccessResponse<IntegrationConnectionDto>>(
        `/api/v1/integrations/${provider}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      const prov = variables.provider || 'github';
      queryClient.invalidateQueries({ queryKey: integrationKeys.status(prov) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.repositories(prov) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.activities(prov) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.events(prov) });
    },
  });
}

export function useSyncIntegration() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: IntegrationProvider = 'github'): Promise<IntegrationSyncResponseDto> => {
      const response = await api.post<ApiSuccessResponse<IntegrationSyncResponseDto>>(
        `/api/v1/integrations/${provider}/sync`,
        {}
      );
      return response.data;
    },
    onSuccess: (_, provider) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.status(provider) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.repositories(provider) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.activities(provider) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.events(provider) });
    },
  });
}

export function useDisconnectIntegration() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: IntegrationProvider = 'github'): Promise<IntegrationConnectionDto> => {
      const response = await api.post<ApiSuccessResponse<IntegrationConnectionDto>>(
        `/api/v1/integrations/${provider}/disconnect`,
        {}
      );
      return response.data;
    },
    onSuccess: (_, provider) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.status(provider) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.repositories(provider) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.activities(provider) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.events(provider) });
    },
  });
}

export function useIntegrationRepositories(
  provider: IntegrationProvider = 'github',
  enabled: boolean = true
) {
  const api = useApiClient();

  return useQuery({
    queryKey: integrationKeys.repositories(provider),
    queryFn: async (): Promise<ExternalRepositoryDto[]> => {
      const response = await api.get<ApiSuccessResponse<ExternalRepositoryDto[]>>(
        `/api/v1/integrations/${provider}/repositories`
      );
      return response.data;
    },
    enabled,
  });
}

export function useIntegrationActivities(
  provider: IntegrationProvider = 'github',
  enabled: boolean = true
) {
  const api = useApiClient();

  return useQuery({
    queryKey: integrationKeys.activities(provider),
    queryFn: async (): Promise<ExternalActivityDto[]> => {
      const response = await api.get<ApiSuccessResponse<ExternalActivityDto[]>>(
        `/api/v1/integrations/${provider}/activities`
      );
      return response.data;
    },
    enabled,
  });
}

export function useIntegrationCalendarEvents(
  provider: IntegrationProvider = 'google_calendar',
  enabled: boolean = true
) {
  const api = useApiClient();

  return useQuery({
    queryKey: integrationKeys.events(provider),
    queryFn: async (): Promise<ExternalCalendarEventDto[]> => {
      const response = await api.get<ApiSuccessResponse<ExternalCalendarEventDto[]>>(
        `/api/v1/integrations/${provider}/events`
      );
      return response.data;
    },
    enabled,
  });
}
