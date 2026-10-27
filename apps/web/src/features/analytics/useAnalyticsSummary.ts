import { useQuery } from '@tanstack/react-query';
import type { ApiSuccessResponse, AnalyticsSummaryDto } from '@avenza/shared';
import { useApiClient } from '../../lib/api-client';

export const analyticsKeys = {
  all: ['analytics'] as const,
  summary: (startDate: string, endDate: string, timezone?: string) =>
    ['analytics', 'summary', startDate, endDate, timezone || 'default'] as const,
};

export function useAnalyticsSummary(
  startDate: string,
  endDate: string,
  timezone?: string
) {
  const api = useApiClient();

  return useQuery({
    queryKey: analyticsKeys.summary(startDate, endDate, timezone),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (timezone) {
        params.set('timezone', timezone);
      }
      const response = await api.get<ApiSuccessResponse<AnalyticsSummaryDto>>(
        `/api/v1/analytics/summary?${params.toString()}`
      );
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
    enabled: Boolean(startDate && endDate),
  });
}
