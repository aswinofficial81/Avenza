import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Calendar,
  Trash2,
  ChevronRight,
  Target,
  ArrowUpDown,
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
} from '../features/goals/components/GoalBadges';
import { CreateGoalModal } from '../features/goals/components/CreateGoalModal';
import { useGoals, useDeleteGoal } from '../features/goals/useGoals';
import type {
  GoalType,
  GoalStatus,
  GoalPriority,
  GoalHealthStatus,
  GoalDto,
} from '@avenza/shared';

export const GoalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Query State
  const search = searchParams.get('search') || '';
  const goalType = (searchParams.get('goal_type') as GoalType) || undefined;
  const status = (searchParams.get('status') as GoalStatus) || undefined;
  const priority = (searchParams.get('priority') as GoalPriority) || undefined;
  const health = (searchParams.get('health') as GoalHealthStatus) || undefined;
  const sortBy = (searchParams.get('sortBy') as 'created_at' | 'target_date' | 'priority' | 'title') || 'created_at';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<GoalDto | null>(null);

  // TanStack Query
  const { data, isLoading, isError, error, refetch } = useGoals({
    search: search || undefined,
    goal_type: goalType,
    status: status,
    priority: priority,
    health: health,
    sortBy,
    sortOrder,
  });

  const deleteGoalMutation = useDeleteGoal();

  // Helper to update URL search params
  const updateFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const goals = data?.data || [];
  const hasActiveFilters = Boolean(search || goalType || status || priority || health);

  const handleDeleteConfirm = async () => {
    if (!goalToDelete) return;
    try {
      await deleteGoalMutation.mutateAsync(goalToDelete.id);
      setGoalToDelete(null);
    } catch {
      // Handled by react-query error / dialog
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Goals</h1>
            <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded bg-surface-2 border border-border">
              {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Your personal growth architecture and multi-horizon target outcomes. Break high-level visions
            into deterministic milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Create Goal
          </Button>
        </div>
      </div>

      {/* 2. Filter & Controls Bar */}
      <div className="bg-surface border border-border rounded-lg p-3 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search goals by title..."
              value={search}
              onChange={(e) => updateFilter('search', e.target.value || undefined)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded bg-surface-2 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Goal Type Filter */}
            <select
              value={goalType || 'all'}
              onChange={(e) => updateFilter('goal_type', e.target.value)}
              className="h-8 px-2.5 text-xs rounded bg-surface-2 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-focus-ring"
              aria-label="Filter by goal type"
            >
              <option value="all">All Types</option>
              <option value="academic">Academic</option>
              <option value="learning">Learning</option>
              <option value="career">Career</option>
              <option value="project">Project</option>
              <option value="personal">Personal</option>
              <option value="custom">Custom</option>
            </select>

            {/* Lifecycle Status Filter */}
            <select
              value={status || 'all'}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="h-8 px-2.5 text-xs rounded bg-surface-2 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-focus-ring"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priority || 'all'}
              onChange={(e) => updateFilter('priority', e.target.value)}
              className="h-8 px-2.5 text-xs rounded bg-surface-2 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-focus-ring"
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            {/* Health Filter */}
            <select
              value={health || 'all'}
              onChange={(e) => updateFilter('health', e.target.value)}
              className="h-8 px-2.5 text-xs rounded bg-surface-2 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-focus-ring"
              aria-label="Filter by health"
            >
              <option value="all">All Health</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="unknown">Unknown</option>
            </select>

            {/* Sort Filter */}
            <div className="flex items-center gap-1">
              <select
                value={sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="h-8 px-2.5 text-xs rounded bg-surface-2 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-focus-ring"
                aria-label="Sort by"
              >
                <option value="created_at">Created Date</option>
                <option value="target_date">Target Date</option>
                <option value="priority">Priority</option>
                <option value="title">Title</option>
              </select>

              <button
                type="button"
                onClick={() => updateFilter('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-8 w-8 flex items-center justify-center rounded bg-surface-2 border border-border text-muted-foreground hover:text-foreground transition-colors"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                aria-label={`Toggle sort order, current ${sortOrder}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSearchParams(new URLSearchParams())}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Content Area */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-border bg-surface space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-2 w-full max-w-xs" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Goals"
          description={error?.message || 'Could not retrieve goals. Please check your connection.'}
          onRetry={() => refetch()}
        />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={<Target className="w-7 h-7 text-muted-foreground" />}
          title={hasActiveFilters ? 'No goals match your filters' : 'Create your first goal'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search criteria or resetting filters to see your goals.'
              : 'Goals bridge long-term vision with deterministic execution. Establish your first milestone-driven target outcome.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={() => setSearchParams(new URLSearchParams())}>
                Clear Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsCreateOpen(true)}
              >
                Create Goal
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const hasMilestones = goal.metrics.milestoneCount > 0;
            const progress = goal.metrics.progressPercentage;

            return (
              <div
                key={goal.id}
                onClick={() => navigate(`/goals/${goal.id}`)}
                className="group relative p-4 rounded-lg border border-border bg-surface hover:border-border-subtle hover:bg-surface-2/60 transition-all cursor-pointer shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Title & Badges */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <GoalTypeBadge type={goal.goal_type} />
                      <GoalPriorityBadge priority={goal.priority} />
                      <GoalStatusBadge status={goal.status} />
                      <GoalHealthBadge health={goal.metrics.healthStatus} />
                    </div>

                    <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {goal.title}
                    </h2>

                    {goal.desired_outcome && (
                      <p className="text-xs text-muted-foreground line-clamp-1 italic">
                        Outcome: &ldquo;{goal.desired_outcome}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Middle / Right: Target Date & Progress */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                    {/* Target Date */}
                    {goal.target_date ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span>
                          Target:{' '}
                          {new Date(goal.target_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60 font-mono shrink-0">
                        No target date
                      </span>
                    )}

                    {/* Progress Bar & Milestone Ratio */}
                    <div className="w-full sm:w-44 space-y-1 shrink-0">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                        <span>
                          {hasMilestones
                            ? `${goal.metrics.completedMilestoneCount}/${goal.metrics.milestoneCount} milestones`
                            : 'No milestones'}
                        </span>
                        <span className="font-semibold text-foreground">{progress}%</span>
                      </div>
                      <Progress value={progress} compact />
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setGoalToDelete(goal)}
                        aria-label={`Delete goal ${goal.title}`}
                        className="p-1.5 rounded text-muted-foreground hover:text-danger hover:bg-rose-500/10 transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5 ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Modals */}
      <CreateGoalModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />

      <ConfirmationDialog
        isOpen={Boolean(goalToDelete)}
        onClose={() => setGoalToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Goal"
        message={
          <>
            Are you sure you want to delete <strong className="text-foreground">{goalToDelete?.title}</strong>?
            All associated milestones will be permanently deleted. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Goal"
        variant="danger"
        isLoading={deleteGoalMutation.isPending}
      />
    </div>
  );
};
