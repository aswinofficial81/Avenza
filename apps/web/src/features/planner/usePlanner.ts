import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../lib/api-client';
import { taskKeys } from '../tasks/useTasks';
import { todayKeys } from '../today/useToday';
import type {
  ApiSuccessResponse,
  ProposeScheduleInput,
  ScheduleProposalResponseDto,
  ApplyScheduleInput,
  ApplyScheduleResponseDto,
} from '@avenza/shared';

export const plannerKeys = {
  all: ['planner'] as const,
  proposal: (date: string) => [...plannerKeys.all, 'proposal', date] as const,
};

export function useScheduleProposal(date: string, enabled = true) {
  const api = useApiClient();

  return useQuery({
    queryKey: plannerKeys.proposal(date),
    queryFn: async (): Promise<ScheduleProposalResponseDto> => {
      const payload: ProposeScheduleInput = { date };
      const response = await api.post<ApiSuccessResponse<ScheduleProposalResponseDto>>(
        '/api/v1/planner/propose',
        payload
      );
      return response.data;
    },
    enabled: Boolean(date) && enabled,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useApplySchedule() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyScheduleInput): Promise<ApplyScheduleResponseDto> => {
      const response = await api.post<ApiSuccessResponse<ApplyScheduleResponseDto>>(
        '/api/v1/planner/apply',
        input
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate planner proposals, tasks, and today's schedule
      queryClient.invalidateQueries({ queryKey: plannerKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: todayKeys.all });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'events'] });
    },
  });
}
