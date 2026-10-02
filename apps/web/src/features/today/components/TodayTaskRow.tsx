import React from 'react';
import { Link } from 'react-router-dom';
import type { TodayTaskItem } from '@avenza/shared';
import {
  TaskBlockedBadge,
  TaskPriorityBadge,
  TaskTypeBadge,
} from '../../tasks/components/TaskBadges';
import { Button } from '../../../components/ui/Button';
import { CheckCircle2, Circle, Clock, FastForward, SkipForward, ExternalLink } from 'lucide-react';

export interface TodayTaskRowProps {
  task: TodayTaskItem;
  onComplete: (taskId: string) => void;
  onDefer?: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  isActionLoading?: boolean;
}

export const TodayTaskRow: React.FC<TodayTaskRowProps> = ({
  task,
  onComplete,
  onDefer,
  onSkip,
  isActionLoading,
}) => {
  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all gap-3 ${
        isCompleted
          ? 'bg-muted/30 border-border/50 text-muted-foreground'
          : 'bg-card border-border hover:border-primary/30 shadow-sm'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        {/* Completion Toggle */}
        <button
          type="button"
          onClick={() => onComplete(task.id)}
          disabled={isActionLoading}
          className="mt-0.5 sm:mt-0 text-muted-foreground hover:text-primary transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-full"
          aria-label={isCompleted ? 'Completed task' : 'Mark task as completed'}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground/60 hover:text-emerald-500 transition-colors" />
          )}
        </button>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/tasks/${task.id}`}
              className={`text-sm sm:text-base font-medium truncate transition-colors hover:text-primary ${
                isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
              }`}
            >
              {task.title}
            </Link>

            {task.is_blocked && !isCompleted && (
              <TaskBlockedBadge
                blockingCount={task.blocking_task_count}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.goal_title && (
              <span className="truncate max-w-[200px]">
                {task.goal_title}
                {task.milestone_title && ` › ${task.milestone_title}`}
              </span>
            )}

            <span className="hidden sm:inline text-muted-foreground/40">•</span>

            <TaskPriorityBadge priority={task.priority} />
            <TaskTypeBadge type={task.task_type} />

            {task.actual_minutes ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <Clock className="w-3 h-3" />
                <span>{task.actual_minutes}m actual</span>
              </span>
            ) : task.estimated_minutes ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{task.estimated_minutes}m est</span>
              </span>
            ) : null}

            {task.due_at && (
              <span>
                Due: {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {task.scheduled_start && (
              <span>
                Scheduled: {new Date(task.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row Actions */}
      <div className="flex items-center gap-1 self-end sm:self-center flex-shrink-0">
        {!isCompleted && onDefer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDefer(task.id)}
            disabled={isActionLoading}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Defer to future"
          >
            <FastForward className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Defer</span>
          </Button>
        )}

        {!isCompleted && onSkip && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSkip(task.id)}
            disabled={isActionLoading}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Skip for today"
          >
            <SkipForward className="w-3.5 h-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Skip</span>
          </Button>
        )}

        <Link
          to={`/tasks/${task.id}`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Open task details"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
};
