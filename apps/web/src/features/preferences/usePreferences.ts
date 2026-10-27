import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import type {
  ApiSuccessResponse,
  UserPreferencesRow,
  UpdatePreferencesInput,
} from '@avenza/shared';

export const preferencesKeys = {
  all: ['preferences'] as const,
  mine: () => [...preferencesKeys.all, 'mine'] as const,
};

export function usePreferences() {
  const api = useApiClient();

  return useQuery({
    queryKey: preferencesKeys.mine(),
    queryFn: async (): Promise<UserPreferencesRow> => {
      const response =
        await api.get<ApiSuccessResponse<UserPreferencesRow>>('/api/v1/preferences');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdatePreferences() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePreferencesInput): Promise<UserPreferencesRow> => {
      const response = await api.patch<ApiSuccessResponse<UserPreferencesRow>>(
        '/api/v1/preferences',
        input
      );
      return response.data;
    },
    onSuccess: (updated) => {
      // Optimistically update cached preferences
      queryClient.setQueryData(preferencesKeys.mine(), updated);
      queryClient.invalidateQueries({ queryKey: preferencesKeys.all });
    },
  });
}
