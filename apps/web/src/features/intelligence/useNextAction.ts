import { useQuery } from '@tanstack/react-query';
import type { ApiSuccessResponse, NextActionResponseData } from '@avenza/shared';
import { useApiClient } from '../../lib/api-client';

export const intelligenceKeys = {
  all: ['intelligence'] as const,
  nextAction: (date?: string) => ['intelligence', 'next-action', date || 'current'] as const,
};

export function useNextAction(date?: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: intelligenceKeys.nextAction(date),
    queryFn: async () => {
      const url = date
        ? `/api/v1/intelligence/next-action?date=${encodeURIComponent(date)}`
        : '/api/v1/intelligence/next-action';
      const response = await api.get<ApiSuccessResponse<NextActionResponseData>>(url);
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}
