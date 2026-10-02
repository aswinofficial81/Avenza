import { useQuery } from '@tanstack/react-query';
import type { ApiSuccessResponse, TodayResponse } from '@avenza/shared';
import { useApiClient } from '../../lib/api-client';

export const todayKeys = {
  all: ['today'] as const,
  date: (date?: string) => ['today', date || 'current'] as const,
};

export function useToday(date?: string) {
  const api = useApiClient();

  return useQuery({
    queryKey: todayKeys.date(date),
    queryFn: async () => {
      const url = date ? `/api/v1/today?date=${encodeURIComponent(date)}` : '/api/v1/today';
      const response = await api.get<ApiSuccessResponse<TodayResponse>>(url);
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}
