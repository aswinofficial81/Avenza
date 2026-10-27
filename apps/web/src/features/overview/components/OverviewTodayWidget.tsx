import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, AlertTriangle, ArrowRight, Clock, Zap } from 'lucide-react';
import { useToday } from '../../today/useToday';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Progress } from '../../../components/ui/Progress';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { TaskPriorityBadge } from '../../tasks/components/TaskBadges';

export const OverviewTodayWidget: React.FC = () => {
  const { data: todayData, isLoading, isError, error, refetch } = useToday();

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-16" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Today's Execution</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Unable to load today's tasks"
            description={(error as Error)?.message || 'Failed to fetch daily execution data.'}
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const summary = todayData?.summary;
  const overdueCount = todayData?.overdue?.length ?? 0;
  const dueTodayTasks = todayData?.dueToday ?? [];
  const scheduledTasks = todayData?.scheduledToday ?? [];
  const completedTodayTasks = todayData?.completedToday ?? [];

  // Combine active tasks for today preview (scheduled + due today)
  const activeTasks = [...scheduledTasks, ...dueTodayTasks].filter(
    (t, idx, self) => self.findIndex((s) => s.id === t.id) === idx
  );

  const totalTasks = activeTasks.length + completedTodayTasks.length;
  const hasTasks = totalTasks > 0 || overdueCount > 0;

  return (
    <Card className="h-full flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Today's Execution</CardTitle>
            </div>
            <Link to="/today">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                View Today
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle flex flex-col">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Planned
              </span>
              <span className="text-xl font-bold font-mono text-foreground mt-0.5">
                {activeTasks.length}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">tasks remaining</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle flex flex-col">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Completed
              </span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {summary?.completedTaskCount ?? completedTodayTasks.length}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">tasks finished</span>
            </div>

            <div className="p-3 rounded-lg bg-surface-2 border border-border-subtle flex flex-col">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Execution
              </span>
              <span className="text-xl font-bold font-mono text-primary mt-0.5">
                {summary?.meaningfulMinutes ?? 0}m
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {summary?.dailyTarget ? `of ${summary.dailyTarget}m target` : 'actual time'}
              </span>
            </div>
          </div>

          {/* Overdue alert badge if any */}
          {overdueCount > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{overdueCount} task{overdueCount > 1 ? 's' : ''} overdue</span>
              </div>
              <Link to="/today">
                <Button variant="outline" size="sm" className="text-[11px] h-6 px-2 border-rose-500/30 text-rose-700 dark:text-rose-300">
                  Review
                </Button>
              </Link>
            </div>
          )}

          {/* Target Progress Bar if configured */}
          {summary && summary.dailyTarget > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Daily Target Progress
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {Math.round(summary.targetProgress)}%
                </span>
              </div>
              <Progress value={summary.targetProgress} className="h-2" />
            </div>
          )}

          {/* Task Preview List */}
          {hasTasks ? (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Upcoming for Today
              </div>
              <div className="space-y-1.5">
                {activeTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2 rounded-md bg-surface border border-border-subtle hover:bg-surface-2 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.priority && <TaskPriorityBadge priority={task.priority} />}
                      {task.estimated_minutes && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {task.estimated_minutes}m
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              title="No tasks scheduled for today"
              description="Your day is clear! Plan tasks or set time blocks from the Today view."
              action={
                <Link to="/today">
                  <Button variant="outline" size="sm" className="text-xs">
                    Plan Today
                  </Button>
                </Link>
              }
              className="py-6 border-none bg-transparent"
            />
          )}
        </CardContent>
      </div>
    </Card>
  );
};
