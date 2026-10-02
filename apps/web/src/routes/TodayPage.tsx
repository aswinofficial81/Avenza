import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToday } from '../features/today/useToday';
import { TodayHeader } from '../features/today/components/TodayHeader';
import { TodayProgress } from '../features/today/components/TodayProgress';
import { NextTaskCard } from '../features/today/components/NextTaskCard';
import { TodaySection } from '../features/today/components/TodaySection';
import { CreateTaskModal } from '../features/tasks/components/CreateTaskModal';
import { useActiveFocusSession } from '../features/focus/useFocusSession';
import { StartFocusModal } from '../features/focus/components/StartFocusModal';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useApiClient } from '../lib/api-client';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { TaskStatus, TodayTaskItem } from '@avenza/shared';

export const TodayPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date') || undefined;

  const { data, isLoading, isError, error, refetch } = useToday(dateParam);
  const { data: activeFocusSession } = useActiveFocusSession();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [focusTargetTask, setFocusTargetTask] = useState<{ id: string; title: string } | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const api = useApiClient();
  const queryClient = useQueryClient();

  // Task Status Mutation (Complete, Defer, Skip)
  const statusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      setActiveTaskId(taskId);
      return api.patch(`/api/v1/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onSettled: () => {
      setActiveTaskId(null);
    },
  });

  const handleComplete = (taskId: string) => {
    statusMutation.mutate({ taskId, status: 'completed' });
  };

  const handleDefer = (taskId: string) => {
    statusMutation.mutate({ taskId, status: 'deferred' });
  };

  const handleSkip = (taskId: string) => {
    statusMutation.mutate({ taskId, status: 'skipped' });
  };

  const handleStartFocus = (task: TodayTaskItem) => {
    setFocusTargetTask({ id: task.id, title: task.title });
    setIsFocusModalOpen(true);
  };

  const activeFocusTaskId =
    activeFocusSession?.status === 'active' ? activeFocusSession.task_id : null;

  const handleDateChange = (newDateStr: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (data?.date === newDateStr) {
      nextParams.delete('date');
    } else {
      nextParams.set('date', newDateStr);
    }
    setSearchParams(nextParams);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6 px-4 sm:px-6">
        <div className="flex justify-between items-center pb-6 border-b border-border">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="space-y-4 pt-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6">
        <ErrorState
          title="Failed to load Today"
          description={
            error instanceof Error ? error.message : 'An error occurred loading daily execution data.'
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const { summary, overdue, dueToday, scheduledToday, upcoming, completedToday, next } = data;

  const totalActiveTasks =
    overdue.length + dueToday.length + scheduledToday.length + upcoming.length;
  const isTotallyEmpty = totalActiveTasks === 0 && completedToday.length === 0;
  const isAllDone =
    overdue.length === 0 &&
    dueToday.length === 0 &&
    scheduledToday.length === 0 &&
    completedToday.length > 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6 px-4 sm:px-6">
      {/* Header */}
      <TodayHeader
        currentDateStr={data.date}
        timezone={data.timezone}
        selectedDate={dateParam || data.date}
        onDateChange={handleDateChange}
        onCreateTask={() => setIsCreateModalOpen(true)}
      />

      {/* Daily Progress */}
      <TodayProgress summary={summary} />

      {/* Main Execution Area */}
      {isTotallyEmpty ? (
        <div className="py-12">
          <EmptyState
            icon={<CalendarCheck className="w-8 h-8 text-primary stroke-[1.5]" />}
            title="Nothing scheduled for today."
            description="Create a task or assign work to a goal to start building your day."
            action={
              <div className="flex items-center gap-2 mt-2">
                <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                  Create Task
                </Button>
                <Link
                  to="/tasks"
                  className="inline-flex items-center justify-center font-medium transition-colors border border-border bg-transparent text-foreground hover:bg-surface-2 active:scale-[0.99] text-xs h-8 px-3 rounded-md"
                >
                  View Tasks
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* All Completed Banner */}
          {isAllDone && (
            <div className="p-4 sm:p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">You&apos;re done for today.</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All scheduled and due tasks have been successfully completed.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs flex-shrink-0"
              >
                Plan More Work
              </Button>
            </div>
          )}

          {/* Next Up Card */}
          {next && !isAllDone && (
            <NextTaskCard
              task={next}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onStartFocus={handleStartFocus}
              activeFocusTaskId={activeFocusTaskId}
              isCompleting={statusMutation.isPending && activeTaskId === next.id}
            />
          )}

          {/* Section: Overdue */}
          {overdue.length > 0 && (
            <TodaySection
              title="Overdue"
              icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}
              count={overdue.length}
              variant="danger"
              tasks={overdue}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onSkip={handleSkip}
              onStartFocus={handleStartFocus}
              activeFocusTaskId={activeFocusTaskId}
            />
          )}

          {/* Section: Due Today */}
          {dueToday.length > 0 && (
            <TodaySection
              title="Due Today"
              icon={<Clock className="w-4 h-4 text-amber-500" />}
              count={dueToday.length}
              variant="warning"
              tasks={dueToday}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onSkip={handleSkip}
              onStartFocus={handleStartFocus}
              activeFocusTaskId={activeFocusTaskId}
            />
          )}

          {/* Section: Scheduled Today */}
          {scheduledToday.length > 0 && (
            <TodaySection
              title="Scheduled Today"
              icon={<Calendar className="w-4 h-4 text-primary" />}
              count={scheduledToday.length}
              variant="default"
              tasks={scheduledToday}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onSkip={handleSkip}
              onStartFocus={handleStartFocus}
              activeFocusTaskId={activeFocusTaskId}
            />
          )}

          {/* Section: Upcoming (Next 7 Days) */}
          {upcoming.length > 0 && (
            <TodaySection
              title="Upcoming (Next 7 Days)"
              icon={<CalendarRange className="w-4 h-4 text-muted-foreground" />}
              count={upcoming.length}
              variant="muted"
              tasks={upcoming}
              onComplete={handleComplete}
              onDefer={handleDefer}
              onSkip={handleSkip}
              onStartFocus={handleStartFocus}
              activeFocusTaskId={activeFocusTaskId}
            />
          )}

          {/* Section: Completed Today */}
          {completedToday.length > 0 && (
            <TodaySection
              title="Completed Today"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              count={completedToday.length}
              variant="muted"
              tasks={completedToday}
              onComplete={handleComplete}
            />
          )}
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Start Focus Modal */}
      <StartFocusModal
        isOpen={isFocusModalOpen}
        onClose={() => {
          setIsFocusModalOpen(false);
          setFocusTargetTask(null);
        }}
        preselectedTask={focusTargetTask}
      />
    </div>
  );
};
