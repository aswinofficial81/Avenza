import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNextAction } from '../../intelligence/useNextAction';
import { useToday } from '../../today/useToday';
import { useActiveFocusSession } from '../../focus/useFocusSession';
import { NextBestActionCard } from '../../intelligence/components/NextBestActionCard';
import { useApiClient } from '../../../lib/api-client';

export const OverviewNextActionWidget: React.FC = () => {
  const navigate = useNavigate();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const {
    data: nextActionData,
    isLoading: isNextLoading,
    isError: isNextError,
    error: nextError,
    refetch: refetchNext,
  } = useNextAction();

  const { data: todayData } = useToday();
  const { data: activeFocusSession } = useActiveFocusSession();

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return api.patch(`/api/v1/tasks/${taskId}`, { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence'] });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deferMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return api.patch(`/api/v1/tasks/${taskId}`, { status: 'deferred' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence'] });
      queryClient.invalidateQueries({ queryKey: ['today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <NextBestActionCard
      data={nextActionData}
      fallbackTask={todayData?.next}
      isLoading={isNextLoading}
      isError={isNextError}
      error={nextError as Error | null}
      onRetry={() => refetchNext()}
      onStartFocus={(task) => {
        navigate(`/focus?taskId=${task.id}`);
      }}
      onComplete={(taskId) => {
        completeMutation.mutate(taskId);
      }}
      onDefer={(taskId) => {
        deferMutation.mutate(taskId);
      }}
      onCreateTask={() => {
        navigate('/today');
      }}
      activeFocusTaskId={activeFocusSession?.task_id}
      isCompleting={completeMutation.isPending}
    />
  );
};
