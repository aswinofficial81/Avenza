import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Edit2,
  Plus,
  Trash2,
  Pause,
  Play,
  Archive,
  Target,
  FileText,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Progress } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import {
  GoalTypeBadge,
  GoalPriorityBadge,
  GoalStatusBadge,
  GoalHealthBadge,
  MilestoneStatusBadge,
} from '../features/goals/components/GoalBadges';
import { EditGoalModal } from '../features/goals/components/EditGoalModal';
import { MilestoneModal } from '../features/goals/components/MilestoneModal';
import {
  useGoal,
  useUpdateGoal,
  useDeleteGoal,
  useUpdateMilestone,
  useDeleteMilestone,
} from '../features/goals/useGoals';
import type { MilestoneDto, GoalStatus, MilestoneStatus } from '@avenza/shared';

export const GoalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Queries & Mutations
  const { data: goal, isLoading, isError, error, refetch } = useGoal(id);
  const updateGoalMutation = useUpdateGoal(id || '');
  const deleteGoalMutation = useDeleteGoal();
  const updateMilestoneMutation = useUpdateMilestone(id || '');
  const deleteMilestoneMutation = useDeleteMilestone(id || '');

  // Modals state
  const [isEditGoalOpen, setIsEditGoalOpen] = useState(false);
  const [isDeleteGoalOpen, setIsDeleteGoalOpen] = useState(false);
  const [milestoneToEdit, setMilestoneToEdit] = useState<MilestoneDto | null>(null);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<MilestoneDto | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-6 w-32" />
        <div className="p-6 rounded-lg border border-border bg-surface space-y-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !goal) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <ErrorState
          title="Goal Not Found"
          description={error?.message || 'The requested goal does not exist or you do not have permission to view it.'}
          onRetry={() => navigate('/goals')}
          retryLabel="Return to Goals"
        />
      </div>
    );
  }

  // Goal Actions
  const handleLifecycleTransition = async (newStatus: GoalStatus) => {
    try {
      await updateGoalMutation.mutateAsync({ status: newStatus });
    } catch {
      // Handled by react-query
    }
  };

  const handleDeleteGoalConfirm = async () => {
    try {
      await deleteGoalMutation.mutateAsync(goal.id);
      navigate('/goals');
    } catch {
      // Handled by react-query
    }
  };

  // Milestone Actions
  const handleToggleMilestone = async (milestone: MilestoneDto) => {
    let nextStatus: MilestoneStatus = 'completed';
    if (milestone.status === 'completed') {
      nextStatus = 'pending';
    } else if (milestone.status === 'pending') {
      nextStatus = 'active';
    }

    try {
      await updateMilestoneMutation.mutateAsync({
        milestoneId: milestone.id,
        data: { status: nextStatus },
      });
    } catch {
      // Handled by react-query
    }
  };

  const handleDeleteMilestoneConfirm = async () => {
    if (!milestoneToDelete) return;
    try {
      await deleteMilestoneMutation.mutateAsync(milestoneToDelete.id);
      setMilestoneToDelete(null);
    } catch {
      // Handled by react-query
    }
  };

  const milestones = goal.milestones || [];
  const nextOrderIndex =
    milestones.length > 0 ? Math.max(...milestones.map((m) => m.order_index)) + 1 : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Navigation & Breadcrumb */}
      <div>
        <Link
          to="/goals"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Goals</span>
        </Link>
      </div>

      {/* 2. Goal Header Card */}
      <div className="p-6 rounded-lg border border-border bg-surface shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <GoalTypeBadge type={goal.goal_type} />
              <GoalPriorityBadge priority={goal.priority} />
              <GoalStatusBadge status={goal.status} />
              <GoalHealthBadge health={goal.metrics.healthStatus} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {goal.title}
            </h1>

            {goal.description && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {goal.description}
              </p>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => setIsEditGoalOpen(true)}
            >
              Edit
            </Button>

            {/* Lifecycle Quick Actions */}
            {goal.status === 'active' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Pause className="w-3.5 h-3.5" />}
                  onClick={() => handleLifecycleTransition('paused')}
                  isLoading={updateGoalMutation.isPending}
                >
                  Pause
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={() => handleLifecycleTransition('completed')}
                  isLoading={updateGoalMutation.isPending}
                >
                  Complete
                </Button>
              </>
            )}

            {goal.status === 'paused' && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play className="w-3.5 h-3.5" />}
                onClick={() => handleLifecycleTransition('active')}
                isLoading={updateGoalMutation.isPending}
              >
                Resume
              </Button>
            )}

            {goal.status === 'completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLifecycleTransition('active')}
                isLoading={updateGoalMutation.isPending}
              >
                Reopen
              </Button>
            )}

            {goal.status !== 'archived' && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Archive className="w-3.5 h-3.5" />}
                onClick={() => handleLifecycleTransition('archived')}
                isLoading={updateGoalMutation.isPending}
                title="Archive Goal"
              >
                Archive
              </Button>
            )}

            {goal.status === 'archived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLifecycleTransition('active')}
                isLoading={updateGoalMutation.isPending}
              >
                Restore
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger hover:bg-rose-500/10"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setIsDeleteGoalOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Detail Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Strategy, Criteria, Milestones */}
        <div className="lg:col-span-2 space-y-6">
          {/* Desired Outcome & Completion Criteria Cards */}
          {(goal.desired_outcome || goal.completion_criteria || goal.notes) && (
            <div className="space-y-4">
              {goal.desired_outcome && (
                <div className="p-4 rounded-lg border border-border bg-surface space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span>Desired Outcome</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {goal.desired_outcome}
                  </p>
                </div>
              )}

              {goal.completion_criteria && (
                <div className="p-4 rounded-lg border border-border bg-surface space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Completion Criteria</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {goal.completion_criteria}
                  </p>
                </div>
              )}

              {goal.notes && (
                <div className="p-4 rounded-lg border border-border bg-surface space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Notes & Strategy</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {goal.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Milestones Section */}
          <div className="p-5 rounded-lg border border-border bg-surface space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Milestones</h2>
                <p className="text-[11px] text-muted-foreground">
                  Sequential progress checkpoints towards achieving this goal.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsAddMilestoneOpen(true)}
              >
                Add Milestone
              </Button>
            </div>

            {milestones.length === 0 ? (
              <EmptyState
                icon={<Target className="w-6 h-6 text-muted-foreground" />}
                title="No milestones defined"
                description="Break this goal down into tangible, deterministic checkpoints."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setIsAddMilestoneOpen(true)}
                  >
                    Add First Milestone
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {milestones.map((ms) => {
                  const isCompleted = ms.status === 'completed';
                  return (
                    <div
                      key={ms.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded border border-border bg-surface-2/40 hover:bg-surface-2/80 transition-colors gap-3"
                    >
                      {/* Left: Step number + Checkbox toggle + Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Status Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(ms)}
                          className={`mt-0.5 shrink-0 rounded transition-colors ${
                            isCompleted
                              ? 'text-emerald-500 hover:text-emerald-600'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title={`Status: ${ms.status}. Click to cycle.`}
                          aria-label={`Toggle status for milestone ${ms.title}`}
                        >
                          <CheckCircle2
                            className={`w-4 h-4 ${isCompleted ? 'fill-emerald-500/20' : ''}`}
                          />
                        </button>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground">
                              #{ms.order_index}
                            </span>
                            <MilestoneStatusBadge status={ms.status} />
                            <GoalPriorityBadge priority={ms.priority} />
                          </div>

                          <h3
                            className={`text-xs font-semibold ${
                              isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {ms.title}
                          </h3>

                          {ms.description && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {ms.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Dates & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                        {ms.target_date && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                            <Calendar className="w-3 h-3 text-muted-foreground/60" />
                            <span>
                              {new Date(ms.target_date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setMilestoneToEdit(ms)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit Milestone"
                            aria-label={`Edit milestone ${ms.title}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setMilestoneToDelete(ms)}
                            className="p-1 rounded text-muted-foreground hover:text-danger hover:bg-rose-500/10 transition-colors"
                            title="Delete Milestone"
                            aria-label={`Delete milestone ${ms.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Progress, Health, Dates */}
        <div className="space-y-4">
          {/* Progress Card */}
          <div className="p-4 rounded-lg border border-border bg-surface space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                Goal Progress
              </span>
              <span className="text-sm font-bold font-mono text-foreground">
                {goal.metrics.progressPercentage}%
              </span>
            </div>

            <Progress value={goal.metrics.progressPercentage} />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1">
              <span>Milestones Completed:</span>
              <span className="font-semibold text-foreground">
                {goal.metrics.completedMilestoneCount} / {goal.metrics.milestoneCount}
              </span>
            </div>
          </div>

          {/* Health Card */}
          <div className="p-4 rounded-lg border border-border bg-surface space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                System Health
              </span>
              <GoalHealthBadge health={goal.metrics.healthStatus} />
            </div>

            {goal.metrics.healthReason && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {goal.metrics.healthReason}
              </p>
            )}

            <div className="pt-2 border-t border-border flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <span>
                Health is deterministically calculated from scheduled dates and milestone pacing.
              </span>
            </div>
          </div>

          {/* Timeline Dates Card */}
          <div className="p-4 rounded-lg border border-border bg-surface space-y-3 shadow-sm text-xs">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono block">
              Timeline & Schedule
            </span>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Start Date:</span>
                <span className="text-foreground">
                  {goal.start_date
                    ? new Date(goal.start_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Not specified'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Target Date:</span>
                <span className="text-foreground">
                  {goal.target_date
                    ? new Date(goal.target_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Not specified'}
                </span>
              </div>

              {goal.completed_at && (
                <div className="flex items-center justify-between py-1 border-b border-border/50 text-emerald-500">
                  <span>Completed At:</span>
                  <span>
                    {new Date(goal.completed_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Created:</span>
                <span className="text-muted-foreground">
                  {new Date(goal.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <EditGoalModal
        isOpen={isEditGoalOpen}
        onClose={() => setIsEditGoalOpen(false)}
        goal={goal}
        onSuccess={() => refetch()}
      />

      <MilestoneModal
        isOpen={isAddMilestoneOpen}
        onClose={() => setIsAddMilestoneOpen(false)}
        goalId={goal.id}
        defaultOrderIndex={nextOrderIndex}
        onSuccess={() => refetch()}
      />

      <MilestoneModal
        isOpen={Boolean(milestoneToEdit)}
        onClose={() => setMilestoneToEdit(null)}
        goalId={goal.id}
        milestone={milestoneToEdit}
        onSuccess={() => refetch()}
      />

      <ConfirmationDialog
        isOpen={isDeleteGoalOpen}
        onClose={() => setIsDeleteGoalOpen(false)}
        onConfirm={handleDeleteGoalConfirm}
        title="Delete Goal"
        message={
          <>
            Are you sure you want to delete <strong className="text-foreground">{goal.title}</strong>? All
            associated milestones will be permanently removed.
          </>
        }
        confirmLabel="Delete Goal"
        variant="danger"
        isLoading={deleteGoalMutation.isPending}
      />

      <ConfirmationDialog
        isOpen={Boolean(milestoneToDelete)}
        onClose={() => setMilestoneToDelete(null)}
        onConfirm={handleDeleteMilestoneConfirm}
        title="Delete Milestone"
        message={
          <>
            Are you sure you want to delete milestone{' '}
            <strong className="text-foreground">{milestoneToDelete?.title}</strong>?
          </>
        }
        confirmLabel="Delete Milestone"
        variant="danger"
        isLoading={deleteMilestoneMutation.isPending}
      />
    </div>
  );
};
