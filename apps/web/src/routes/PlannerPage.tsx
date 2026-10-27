import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { useScheduleProposal, useApplySchedule } from '../features/planner/usePlanner';
import { PlannerHeader } from '../features/planner/components/PlannerHeader';
import { PlannerContextCard } from '../features/planner/components/PlannerContextCard';
import { PlannerProposalList } from '../features/planner/components/PlannerProposalList';
import { PlannerUnscheduledList } from '../features/planner/components/PlannerUnscheduledList';
import { PlannerReviewModal } from '../features/planner/components/PlannerReviewModal';
import { StudyPreferencesSetupModal } from '../features/preferences/components/StudyPreferencesSetupModal';

/** Detects the configuration-required error message returned by the API */
function isConfigurationRequired(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('study window preferences') ||
    msg.includes('configuration_required') ||
    msg.includes('preferred_study_start') ||
    msg.includes('preferred_study_end')
  );
}

export const PlannerPage: React.FC = () => {
  const getTodayString = () => new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [isDiscarded, setIsDiscarded] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null);

  const {
    data: proposal,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useScheduleProposal(selectedDate, !isDiscarded);

  const applyMutation = useApplySchedule();

  // Detect configuration errors surfaced by the proposal query
  const needsSetup = isError && isConfigurationRequired(error);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setIsDiscarded(false);
    setApplyError(null);
    setApplySuccessMessage(null);
  };

  const handleRefresh = () => {
    setIsDiscarded(false);
    setApplyError(null);
    setApplySuccessMessage(null);
    refetch();
  };

  const handleDiscard = () => {
    setIsDiscarded(true);
    setApplyError(null);
    setApplySuccessMessage(null);
  };

  const handleConfirmApply = async () => {
    if (!proposal || proposal.proposedBlocks.length === 0) return;

    setApplyError(null);
    setApplySuccessMessage(null);

    const blocksToApply = proposal.proposedBlocks.map((b) => ({
      taskId: b.taskId,
      scheduledStart: b.scheduledStart,
      scheduledEnd: b.scheduledEnd,
      expectedUpdatedAt: b.expectedUpdatedAt,
    }));

    try {
      const res = await applyMutation.mutateAsync({
        proposalId: proposal.proposalId,
        targetDate: selectedDate,
        blocks: blocksToApply,
      });

      setIsReviewModalOpen(false);
      setApplySuccessMessage(
        `Successfully scheduled ${res.appliedCount} task(s) for ${selectedDate}. Your calendar and agenda have been updated.`
      );
      // Refresh proposal to reflect newly scheduled state
      refetch();
    } catch (err: unknown) {
      setIsReviewModalOpen(false);
      const msg = err instanceof Error ? err.message : 'Failed to apply schedule proposal.';
      setApplyError(msg);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <PlannerHeader
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onRefresh={handleRefresh}
        isLoading={isLoading || isFetching}
      />

      {/* Success Banner */}
      {applySuccessMessage && (
        <Alert variant="success" title="Schedule Applied" className="text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1">
            <span>{applySuccessMessage}</span>
            <div className="flex items-center gap-2">
              <Link to="/today" className="underline font-semibold hover:text-[var(--color-primary)]">
                View in Today →
              </Link>
              <Link to="/calendar" className="underline font-semibold hover:text-[var(--color-primary)] ml-2">
                View in Calendar →
              </Link>
            </div>
          </div>
        </Alert>
      )}

      {/* Conflict / Stale Plan Error Banner */}
      {applyError && (
        <Alert
          variant="danger"
          title="Schedule Conflict or Stale Proposal"
          className="text-sm"
        >
          <div className="space-y-2 mt-1">
            <p>{applyError}</p>
            <p className="text-xs opacity-90">
              One or more tasks or calendar events may have changed since this plan was computed. Please refresh to generate an up-to-date schedule.
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Refresh Proposal Now
            </Button>
          </div>
        </Alert>
      )}

      {/* Discarded State */}
      {isDiscarded && (
        <EmptyState
          title="Proposal Discarded"
          description="The proposal was cleared. No task schedules or statuses were modified."
          action={
            <Button variant="primary" size="sm" onClick={handleRefresh}>
              Generate New Proposal
            </Button>
          }
        />
      )}

      {/* Loading Skeleton */}
      {!isDiscarded && isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {/* Study Preferences Setup Required */}
      {!isDiscarded && !isLoading && needsSetup && (
        <ErrorState
          title="Study Schedule Not Configured"
          description="Avenza needs to know your available study hours before it can generate a plan. Set up your study window now and we'll generate your schedule immediately."
          onRetry={() => setIsSetupModalOpen(true)}
          retryLabel="Configure Study Schedule"
        />
      )}

      {/* Generic Query Error State (non-configuration errors) */}
      {!isDiscarded && !isLoading && isError && !needsSetup && (
        <ErrorState
          title="Failed to generate schedule"
          description={error instanceof Error ? error.message : 'An error occurred while computing the proposal.'}
          onRetry={handleRefresh}
        />
      )}

      {/* Active Proposal View */}
      {!isDiscarded && !isLoading && proposal && (
        <div className="space-y-6">
          {/* Scheduling Context */}
          <PlannerContextCard proposal={proposal} />

          {/* Action Bar (Apply & Discard) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded-xl">
            <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {proposal.proposedBlocks.length > 0 ? (
                <span>
                  <strong className="text-[var(--color-text-primary)]">
                    {proposal.proposedBlocks.length} task{proposal.proposedBlocks.length !== 1 ? 's' : ''}
                  </strong>
                  {' ready to schedule — '}
                  <strong className="text-[var(--color-text-primary)]">{proposal.totalProposedMinutes}m</strong>
                  {' total. Review below before applying.'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] shrink-0" />
                  No eligible tasks to schedule for this date. All tasks may be complete, blocked, or outside your study window.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                disabled={applyMutation.isPending}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsReviewModalOpen(true)}
                disabled={proposal.proposedBlocks.length === 0 || applyMutation.isPending}
                className={proposal.proposedBlocks.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}
              >
                Apply Schedule
              </Button>
            </div>
          </div>

          {/* Proposed Timeline */}
          <PlannerProposalList
            proposedBlocks={proposal.proposedBlocks}
            existingCommitments={proposal.existingCommitments}
          />

          {/* Unscheduled Tasks */}
          <PlannerUnscheduledList unscheduledTasks={proposal.unscheduledTasks} />

          {/* Review Confirmation Modal */}
          <PlannerReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => setIsReviewModalOpen(false)}
            onConfirm={handleConfirmApply}
            proposal={proposal}
            isApplying={applyMutation.isPending}
          />
        </div>
      )}

      {/* Study Preferences Setup Modal */}
      <StudyPreferencesSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onSaved={handleRefresh}
      />
    </div>
  );
};
