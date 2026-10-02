import React from 'react';
import { Link } from 'react-router-dom';
import type { TodayTaskItem } from '@avenza/shared';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { TaskPriorityBadge, TaskTypeBadge } from '../../tasks/components/TaskBadges';
import { ArrowRight, CheckCircle2, Clock, FastForward, Sparkles } from 'lucide-react';

export interface NextTaskCardProps {
  task: TodayTaskItem | null;
  onComplete: (taskId: string) => void;
  onDefer: (taskId: string) => void;
  isCompleting?: boolean;
}

export const NextTaskCard: React.FC<NextTaskCardProps> = ({
  task,
  onComplete,
  onDefer,
  isCompleting,
}) => {
  if (!task) return null;

  return (
    <Card className="p-5 sm:p-6 border-primary/30 bg-primary/[0.02] dark:bg-primary/[0.04] shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next Up</span>
            </span>

            {task.goal_title && (
              <span className="text-xs text-muted-foreground truncate">
                {task.goal_title}
                {task.milestone_title && ` › ${task.milestone_title}`}
              </span>
            )}
          </div>

          <div>
            <Link
              to={`/tasks/${task.id}`}
              className="text-lg sm:text-xl font-bold text-foreground hover:text-primary transition-colors block truncate"
            >
              {task.title}
            </Link>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-2xl">
                {task.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <TaskPriorityBadge priority={task.priority} />
            <TaskTypeBadge type={task.task_type} />

            {task.estimated_minutes && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                <Clock className="w-3 h-3" />
                <span>{task.estimated_minutes}m est</span>
              </span>
            )}

            {task.due_at && (
              <span className="text-xs text-muted-foreground">
                Due: {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onComplete(task.id)}
            isLoading={isCompleting}
            className="gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDefer(task.id)}
            className="gap-1.5"
          >
            <FastForward className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Defer</span>
          </Button>

          <Link
            to={`/tasks/${task.id}`}
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
