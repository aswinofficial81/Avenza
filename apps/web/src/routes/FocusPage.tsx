import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useActiveFocusSession,
  useCompleteFocusSession,
  useCancelFocusSession,
} from '../features/focus/useFocusSession';
import { FocusTimer } from '../features/focus/components/FocusTimer';
import { FocusSessionControls } from '../features/focus/components/FocusSessionControls';
import { FocusSessionSummary } from '../features/focus/components/FocusSessionSummary';
import { StartFocusModal } from '../features/focus/components/StartFocusModal';
import { Button } from '../components/ui/Button';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Flame, History, ArrowRight } from 'lucide-react';

export const FocusPage: React.FC = () => {
  const { data: activeSession, isLoading, isError, refetch } = useActiveFocusSession();
  const completeMutation = useCompleteFocusSession();
  const cancelMutation = useCancelFocusSession();

  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleComplete = async (notes?: string) => {
    if (!activeSession) return;
    setActionError(null);
    try {
      await completeMutation.mutateAsync({
        id: activeSession.id,
        notes,
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setActionError(
        errorObj?.response?.data?.error?.message ||
          errorObj?.message ||
          'Failed to complete session. Please try again.'
      );
    }
  };

  const handleCancel = async (notes?: string) => {
    if (!activeSession) return;
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({
        id: activeSession.id,
        notes,
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setActionError(
        errorObj?.response?.data?.error?.message ||
          errorObj?.message ||
          'Failed to cancel session. Please try again.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-col items-center justify-center p-12">
          <Skeleton className="w-56 h-56 rounded-full mb-6" />
          <Skeleton className="h-10 w-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">Failed to load focus state</h2>
        <p className="text-sm text-muted-foreground">
          Could not communicate with the focus service.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/overview' },
              { label: 'Focus', isCurrent: true },
            ]}
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Focus Session
          </h1>
          <p className="text-xs text-muted-foreground">
            Execute intentionally. Measure real focused work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/focus/history">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" />
              <span>Focus History</span>
            </Button>
          </Link>
          {!activeSession && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStartModalOpen(true)}
              className="gap-1.5 shadow-sm text-xs font-semibold"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Start Focus</span>
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
          {actionError}
        </div>
      )}

      {/* Active Session Content OR Calm Empty State */}
      {activeSession && activeSession.status === 'active' ? (
        <div className="space-y-6">
          {/* Prominent Drift-Proof Timer */}
          <FocusTimer
            startedAt={activeSession.started_at}
            plannedMinutes={activeSession.planned_minutes}
          />

          {/* Controls: Complete, Cancel, Optional Notes */}
          <FocusSessionControls
            onComplete={handleComplete}
            onCancel={handleCancel}
            isCompleting={completeMutation.isPending}
            isCancelling={cancelMutation.isPending}
          />

          {/* Session & Target Task Summary */}
          <FocusSessionSummary session={activeSession} />
        </div>
      ) : (
        <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-border bg-card/50 text-center">
          <EmptyState
            title="No active focus session"
            description="Focus sessions represent periods of intentional, uninterrupted execution on a specific task."
            icon={<Flame className="h-6 w-6 stroke-[1.5] text-primary" />}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsStartModalOpen(true)}
                className="gap-1.5 shadow-sm text-xs font-semibold"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Start Focus</span>
              </Button>
            }
          />

          <div className="mt-6 pt-6 border-t border-border/60 max-w-sm mx-auto flex items-center justify-between text-xs text-muted-foreground">
            <span>Looking for past sessions?</span>
            <Link
              to="/focus/history"
              className="text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <span>View History</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Modal for initiating session */}
      <StartFocusModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
      />
    </div>
  );
};
