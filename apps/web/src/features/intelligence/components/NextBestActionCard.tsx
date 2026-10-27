import React from 'react';
import { Link } from 'react-router-dom';
import type { NextActionConfidence, NextActionResponseData, TaskPriority, TodayTaskItem } from '@avenza/shared';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TaskPriorityBadge } from '../../tasks/components/TaskBadges';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FastForward,
  Flame,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export interface NextBestActionCardProps {
  data?: NextActionResponseData | null;
  fallbackTask?: TodayTaskItem | null;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onStartFocus?: (task: { id: string; title: string }) => void;
  onComplete?: (taskId: string) => void;
  onDefer?: (taskId: string) => void;
  onCreateTask?: () => void;
  activeFocusTaskId?: string | null;
  isCompleting?: boolean;
}

export const NextBestActionCard: React.FC<NextBestActionCardProps> = ({
  data,
  fallbackTask,
  isLoading,
  isError,
  error,
  onRetry,
  onStartFocus,
  onComplete,
  onDefer,
  onCreateTask,
  activeFocusTaskId,
  isCompleting,
}) => {
  // If no intelligence data yet, but fallbackTask is present, use fallbackTask without flashing skeleton
  const effectiveAction = data?.action || (fallbackTask ? {
    type: 'focus_task' as const,
    taskId: fallbackTask.id,
    title: fallbackTask.title,
    score: 80,
    goalTitle: fallbackTask.goal_title,
    milestoneTitle: fallbackTask.milestone_title,
    priority: fallbackTask.priority,
    dueAt: fallbackTask.due_at,
    estimatedMinutes: fallbackTask.estimated_minutes,
  } : null);

  const effectiveReason = data?.reason || {
    code: 'user_priority' as const,
    label: 'Recommended',
    explanation: 'Top prioritized task for today based on urgency and goals.',
  };

  const effectiveConfidence: NextActionConfidence = data?.confidence || 'high';

  // 1. Loading State (only if no data and no fallback task)
  if (isLoading && !effectiveAction) {
    return (
      <Card className="p-5 sm:p-6 border-border/80 bg-surface shadow-sm relative overflow-hidden">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/4 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-xl rounded" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </Card>
    );
  }

  // 2. Error State (only if no fallback task)
  if (isError && !effectiveAction) {
    return (
      <Card className="p-5 sm:p-6 border-red-500/20 bg-red-500/5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
              Unable to compute Next Best Action
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {error?.message || 'An error occurred while evaluating contextual work.'}
            </p>
          </div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 self-start sm:self-auto">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // 3. Calm No-Action State (explicit empty from intelligence engine and no fallback)
  if (!effectiveAction) {
    return (
      <Card className="p-5 sm:p-6 border-border/60 bg-surface/50 dark:bg-surface/30 backdrop-blur-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                Next Best Action
              </span>
              <Badge variant="secondary" className="text-[10px] py-0 px-2">
                All Clear
              </Badge>
            </div>
            <p className="text-sm font-medium text-foreground">
              {data?.reason?.explanation || 'There are no actionable tasks available right now.'}
            </p>
          </div>
          {onCreateTask && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateTask}
              className="text-xs self-start sm:self-auto flex-shrink-0"
            >
              Plan New Task
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const isCurrentlyInFocus = activeFocusTaskId === effectiveAction.taskId;

  const confidenceBadgeVariant: Record<NextActionConfidence, 'success' | 'info' | 'secondary'> = {
    high: 'success',
    medium: 'info',
    low: 'secondary',
  };

  return (
    <Card
      className="p-5 sm:p-6 border-teal-500/30 dark:border-teal-400/20 bg-card/90 dark:bg-card/90 shadow-sm hover:shadow-glow relative overflow-hidden transition-all duration-300"
      data-testid="next-best-action-card"
    >
      {/* Indicator bar */}
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-teal-400 to-teal-600" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 flex-1 min-w-0">
          {/* Header Row: Next Best Action & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Next Best Action</span>
              <span className="text-primary/40 font-light">|</span>
              <span className="text-[10px] text-primary/80 font-medium">Next Up</span>
            </span>

            <Badge variant="info" className="text-xs py-0.5 px-2">
              {effectiveReason.label}
            </Badge>

            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span>Confidence:</span>
              <Badge variant={confidenceBadgeVariant[effectiveConfidence]} className="text-[10px] py-0 px-1.5 capitalize">
                {effectiveConfidence}
              </Badge>
            </span>

            {effectiveAction.goalTitle && (
              <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <span>•</span>
                <span className="truncate">{effectiveAction.goalTitle}</span>
                {effectiveAction.milestoneTitle && <span className="truncate">› {effectiveAction.milestoneTitle}</span>}
              </span>
            )}

            {effectiveAction.projectTitle && (
              <span className="text-xs text-muted-foreground truncate flex items-center gap-1 font-mono">
                <span>•</span>
                <span className="truncate text-foreground/90 font-medium">{effectiveAction.projectTitle}</span>
                {effectiveAction.projectMilestoneTitle && (
                  <span className="truncate text-muted-foreground">› {effectiveAction.projectMilestoneTitle}</span>
                )}
              </span>
            )}

            {effectiveAction.companyName && (
              <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <span>•</span>
                <span className="truncate text-primary font-medium">{effectiveAction.companyName}</span>
                {effectiveAction.careerRoundType && (
                  <span className="truncate text-muted-foreground">({effectiveAction.careerRoundType})</span>
                )}
              </span>
            )}
          </div>

          {/* Action Task Title */}
          <div>
            <Link
              to={`/tasks/${effectiveAction.taskId}`}
              className="text-lg sm:text-xl font-bold text-foreground hover:text-primary transition-colors block truncate"
            >
              {effectiveAction.title}
            </Link>

            {(effectiveAction.projectTitle || effectiveAction.projectMilestoneTitle) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-0.5">
                {effectiveAction.projectTitle && (
                  <span className="font-semibold text-foreground/80">{effectiveAction.projectTitle}</span>
                )}
                {effectiveAction.projectTitle && effectiveAction.projectMilestoneTitle && <span>·</span>}
                {effectiveAction.projectMilestoneTitle && (
                  <span>{effectiveAction.projectMilestoneTitle}</span>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-2xl font-serif italic text-foreground/80">
              &ldquo;{effectiveReason.explanation}&rdquo;
            </p>
          </div>

          {/* Metadata Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {effectiveAction.priority && <TaskPriorityBadge priority={effectiveAction.priority as TaskPriority} />}

            {effectiveAction.estimatedMinutes && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                <Clock className="w-3 h-3" />
                <span>{effectiveAction.estimatedMinutes}m est</span>
              </span>
            )}

            {effectiveAction.dueAt && (
              <span className="text-xs text-muted-foreground">
                Due: {new Date(effectiveAction.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Primary Action Button */}
          {isCurrentlyInFocus ? (
            <Link
              to="/focus"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-all"
            >
              <Flame className="w-4 h-4 fill-current" />
              <span>In Focus</span>
            </Link>
          ) : (
            onStartFocus && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onStartFocus({ id: effectiveAction.taskId, title: effectiveAction.title })}
                className="gap-1.5 shadow-sm"
              >
                <Flame className="w-4 h-4" />
                <span>Start Focus</span>
              </Button>
            )
          )}

          {onComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onComplete(effectiveAction.taskId)}
              isLoading={isCompleting}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete</span>
            </Button>
          )}

          {onDefer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDefer(effectiveAction.taskId)}
              className="gap-1.5 hidden sm:inline-flex"
            >
              <FastForward className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Defer</span>
            </Button>
          )}

          <Link
            to={`/tasks/${effectiveAction.taskId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <span>View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
};
