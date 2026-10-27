import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    ApiSuccessResponse,
    WeeklyReviewSaveInput,
    WeeklyReviewSummary,
} from '@avenza/shared';
import { useApiClient } from '../../lib/api-client';

export const weeklyReviewKeys = {
    all: ['weekly-review'] as const,
    summary: (weekStart: string, timezone: string) =>
        ['weekly-review', weekStart, timezone] as const,
};

export function useWeeklyReview(weekStart: string, timezone: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: weeklyReviewKeys.summary(weekStart, timezone),
        queryFn: async (): Promise<WeeklyReviewSummary> => {
            const params = new URLSearchParams({ weekStart, timezone });
            const response = await api.get<ApiSuccessResponse<WeeklyReviewSummary>>(
                `/api/v1/weekly-review?${params.toString()}`,
            );

            return response.data;
        },
        staleTime: 10_000,
    });
}

export function useSaveWeeklyReview() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (
            input: WeeklyReviewSaveInput,
        ): Promise<WeeklyReviewSummary> => {
            const response = await api.put<ApiSuccessResponse<WeeklyReviewSummary>>(
                '/api/v1/weekly-review',
                input,
            );

            return response.data;
        },
        onSuccess: async (summary) => {
            await queryClient.invalidateQueries({
                queryKey: weeklyReviewKeys.summary(
                    summary.weekStart,
                    summary.timezone,
                ),
            });
        },
    });
}