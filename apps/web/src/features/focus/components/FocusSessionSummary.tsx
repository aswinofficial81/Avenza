import React from 'react';
import { Link } from 'react-router-dom';
import type { FocusSessionDto } from '@avenza/shared';
import {
  TaskPriorityBadge,
  TaskTypeBadge,
  TaskStatusBadge,
} from '../../tasks/components/TaskBadges';
import { Card } from '../../../components/ui/Card';
import { Target, Clock, Calendar, FileText, CheckCircle2, XCircle } from 'lucide-react';

export interface FocusSessionSummaryProps {
  session: FocusSessionDto;
}

export const FocusSessionSummary: React.FC<FocusSessionSummaryProps> = ({ session }) => {
  const task = session.task;
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const isActive = session.status === 'active';

  return (
    <Card className="p-5 sm:p-6 bg-card border-border space-y-4">
      {/* Session Header Status */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Session Details
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium capitalize bg-primary/10 text-primary border border-primary/20">
            {session.session_type.replace('_', ' ')}
          </span>
        </div>

        <div>
          {isActive && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed ({session.actual_minutes ?? 0}m actual)
            </span>
          )}
          {isCancelled && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              <XCircle className="w-3.5 h-3.5" />
              Cancelled
            </span>
          )}
        </div>
      </div>

      {/* Linked Task Information */}
      {task ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span>Target Task</span>
          </div>

          <Link
            to={`/tasks/${task.id}`}
            className="text-base sm:text-lg font-bold text-foreground hover:text-primary transition-colors block truncate"
          >
            {task.title}
          </Link>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <TaskTypeBadge type={task.task_type} />

            {task.goal_title && (
              <span className="text-xs text-muted-foreground truncate max-w-xs">
                Goal: {task.goal_title}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">
          No task attached to this session.
        </div>
      )}

      {/* Meta Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-border/60">
        <div className="space-y-0.5">
          <span className="text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            Started At
          </span>
          <span className="font-medium text-foreground">
            {new Date(session.started_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>

        <div className="space-y-0.5">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            Planned Duration
          </span>
          <span className="font-medium text-foreground">{session.planned_minutes} minutes</span>
        </div>

        {session.actual_minutes !== null && (
          <div className="space-y-0.5">
            <span className="text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Observed Execution
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {session.actual_minutes} minutes
            </span>
          </div>
        )}
      </div>

      {/* Session Notes if any */}
      {session.notes && (
        <div className="pt-2 border-t border-border/60 space-y-1">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <FileText className="w-3 h-3 text-muted-foreground" />
            Session Notes
          </span>
          <p className="text-xs text-foreground/90 whitespace-pre-wrap bg-muted/40 p-2.5 rounded-lg border border-border/50">
            {session.notes}
          </p>
        </div>
      )}
    </Card>
  );
};
